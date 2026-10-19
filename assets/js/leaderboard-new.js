(function($) {
    'use strict';

    // SVG Icons for UI elements
    const Icons = {
        StarFill: '<svg class="jp-star" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
        Facebook: '<svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>',
        FacebookSmall: '<svg class="w-2.5 h-2.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>',
        ChevronLeft: '<svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>',
        ChevronRight: '<svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>'
    };

    // Badge Configuration - loaded from external badges-config.js
    const BadgeConfig = window.JPBadgeConfig || {};

    window.JPLeaderboardNew = {
        data: [],
        categories: [],
        headersByCategory: {},
        state: {
            currentPage: 1,
            itemsPerPage: 100,
            activeCategory: '',
            searchQuery: '',
            nhom: ''
        },
        isCategoryRoute: false,
        _originalSeo: null,
        _eventsBound: false,

        init: function(data, categories, headersByCategory, initialCategory, isCategoryRoute) {
            this.data = data || [];
            this.categories = categories || [];
            this.headersByCategory = headersByCategory || {};
            this.state.categories = categories || [];
            this.initializeRouteState(initialCategory, isCategoryRoute);

            this.renderHeaders();
            this.renderTabs();
            this.renderTable();
            this.setupEventListeners();
            this.initLiveStrip();
        },

        // ===== Laravel mode: server-paginated qua WP proxy (jp_bxh_*) =====
        laravelMode: false,
        _totalPages: 1,
        _total: 0,
        _loading: false,
        _searchTimer: null,
        _xhr: null,
        _requestSeq: 0,

        initLaravel: function(categories, initialCategory, isCategoryRoute) {
            this.laravelMode = true;
            this.categories = categories || [];
            this.state.categories = categories || [];
            this.headersByCategory = {};
            this.initializeRouteState(initialCategory, isCategoryRoute);

            this.renderHeaders();
            this.renderTabs();
            this.renderNhomBar();
            this.setupEventListeners();
            this.loadPage();
            this.initLiveStrip();
        },

        // ===== Băng chữ LIVE: đơn giải chạy online + cửa hàng gần đây =====
        _liveItems: [],

        initLiveStrip: function() {
            var self = this;
            if (!document.getElementById('jp-live-strip')) return;

            this.loadLiveStrip();
            // Tải lại danh sách mỗi 90 giây (máy chủ đã đệm 60 giây).
            setInterval(function() { self.loadLiveStrip(); }, 90000);
            // Chỉ tính lại "x phút trước" mỗi 60 giây — không cần gọi mạng.
            setInterval(function() { self.refreshLiveAgo(); }, 60000);
        },

        loadLiveStrip: function() {
            var self = this;
            $.ajax({
                url: this.ajaxUrl(),
                type: 'GET',
                dataType: 'json',
                data: { action: 'jp_bxh_live', days: 7, limit: 30 },
                timeout: 8000
            }).done(function(res) {
                if (res && Array.isArray(res.data) && res.data.length) {
                    self.renderLiveStrip(res.data);
                } else if (window.VBM_FALLBACK_DATA && window.VBM_FALLBACK_DATA.live && window.VBM_FALLBACK_DATA.live.data) {
                    self.renderLiveStrip(window.VBM_FALLBACK_DATA.live.data);
                } else {
                    self.renderLiveStrip([]);
                }
            }).fail(function() {
                if (window.VBM_FALLBACK_DATA && window.VBM_FALLBACK_DATA.live && window.VBM_FALLBACK_DATA.live.data) {
                    self.renderLiveStrip(window.VBM_FALLBACK_DATA.live.data);
                } else {
                    self.renderLiveStrip([]);
                }
            });
        },

        renderLiveStrip: function(items) {
            var strip = document.getElementById('jp-live-strip');
            var track = document.getElementById('jp-live-track');
            if (!strip || !track) return;

            if (!Array.isArray(items) || items.length === 0) {
                strip.hidden = true;
                track.replaceChildren();
                this._liveItems = [];
                return;
            }

            this._liveItems = items;
            track.replaceChildren();

            // Đổ nội dung HAI lần liền nhau: hết lượt 1 là lượt 2 vào đúng vị trí,
            // nên vòng lặp trôi liền mạch, không thấy chỗ nối.
            for (var pass = 0; pass < 2; pass++) {
                items.forEach(function(it) {
                    track.appendChild(this.buildLiveItem(it, pass === 1));
                    var sep = document.createElement('span');
                    sep.className = 'jp-live-sep';
                    sep.setAttribute('aria-hidden', 'true');
                    track.appendChild(sep);
                }, this);
            }

            strip.hidden = false;

            // Tốc độ cố định (~70px/giây) → danh sách dài thì chạy lâu hơn,
            // chứ không phải chạy nhanh hơn.
            var half = track.scrollWidth / 2;
            var seconds = Math.max(25, Math.round(half / 70));
            track.style.setProperty('--jp-live-duration', seconds + 's');
        },

        buildLiveItem: function(it, isClone) {
            var a = document.createElement('a');
            a.className = 'jp-live-item';
            a.href = it.url || '#';
            a.target = '_blank';
            a.rel = 'noopener';
            // Bản nhân đôi chỉ để chạy cho liền mạch → giấu khỏi trình đọc màn hình.
            if (isClone) a.setAttribute('aria-hidden', 'true');

            var name = document.createElement('span');
            name.className = 'jp-live-name';
            name.textContent = it.name || '';

            var act = document.createElement('span');
            act.textContent = it.action || '';

            var title = document.createElement('span');
            title.className = 'jp-live-title';
            title.textContent = this.trimLiveTitle(it.title || '');

            var ago = document.createElement('span');
            ago.className = 'jp-live-ago';
            ago.dataset.at = it.at || '';
            ago.textContent = '· ' + this.timeAgo(it.at);

            a.appendChild(name);
            a.appendChild(act);
            a.appendChild(title);
            a.appendChild(ago);
            return a;
        },

        // Tên giải dài (vd "TỰ HÀO VIỆT NAM — GIẢI CHẠY MỪNG QUỐC KHÁNH 2/9") sẽ
        // chiếm hết băng chữ → cắt bớt cho gọn.
        trimLiveTitle: function(s) {
            s = String(s).trim();
            return s.length > 46 ? s.slice(0, 45).trim() + '…' : s;
        },

        // Mốc giờ máy chủ gửi kèm múi giờ (ISO 8601) nên trình duyệt tự quy đổi
        // đúng giờ Việt Nam, không lệch.
        timeAgo: function(iso) {
            var t = Date.parse(iso);
            if (isNaN(t)) return '';
            var s = Math.floor((Date.now() - t) / 1000);
            if (s < 60) return 'vừa xong';
            var m = Math.floor(s / 60);
            if (m < 60) return m + ' phút trước';
            var h = Math.floor(m / 60);
            if (h < 24) return h + ' giờ trước';
            return Math.floor(h / 24) + ' ngày trước';
        },

        refreshLiveAgo: function() {
            var self = this;
            document.querySelectorAll('#jp-live-track .jp-live-ago').forEach(function(el) {
                if (el.dataset.at) el.textContent = '· ' + self.timeAgo(el.dataset.at);
            });
        },

        ajaxUrl: function() {
            return (window.jpgs && window.jpgs.ajax_url) ? window.jpgs.ajax_url : '/wp-admin/admin-ajax.php';
        },

        getCategory: function(categoryId) {
            return (this.categories || []).find(function(category) {
                return category.id === categoryId;
            }) || null;
        },

        escapeHtml: function(value) {
            return String(value == null ? '' : value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        },

        getMetaContent: function(selector) {
            var element = document.head.querySelector(selector);
            return element ? element.getAttribute('content') : null;
        },

        captureOriginalSeo: function() {
            if (this._originalSeo) return;
            var canonical = document.head.querySelector('link[rel="canonical"]');
            var text = function(id) {
                var element = document.getElementById(id);
                return element ? element.textContent : null;
            };
            this._originalSeo = {
                title: document.title,
                canonical: canonical ? canonical.getAttribute('href') : null,
                description: this.getMetaContent('meta[name="description"]'),
                ogTitle: this.getMetaContent('meta[property="og:title"]'),
                ogDescription: this.getMetaContent('meta[property="og:description"]'),
                ogUrl: this.getMetaContent('meta[property="og:url"]'),
                ogImage: this.getMetaContent('meta[property="og:image"]'),
                twitterTitle: this.getMetaContent('meta[name="twitter:title"]'),
                twitterDescription: this.getMetaContent('meta[name="twitter:description"]'),
                twitterImage: this.getMetaContent('meta[name="twitter:image"]'),
                introSectionHidden: document.getElementById('jp-leaderboard-seo-intro')
                    ? document.getElementById('jp-leaderboard-seo-intro').hidden
                    : null,
                primaryTitle: text('jp-page-primary-title'),
                heading: text('jp-leaderboard-heading'),
                intro: text('jp-leaderboard-intro'),
                breadcrumb: text('jp-leaderboard-breadcrumb')
            };
        },

        upsertMeta: function(selector, attributes, content) {
            var element = document.head.querySelector(selector);
            if (!element) {
                element = document.createElement('meta');
                Object.keys(attributes).forEach(function(name) {
                    element.setAttribute(name, attributes[name]);
                });
                element.setAttribute('data-jp-bxh-dynamic', '1');
                document.head.appendChild(element);
            }
            element.setAttribute('content', content || '');
        },

        restoreMeta: function(selector, content) {
            var element = document.head.querySelector(selector);
            if (!element) return;
            if (content === null && element.getAttribute('data-jp-bxh-dynamic') === '1') {
                element.remove();
                return;
            }
            if (content !== null) element.setAttribute('content', content);
        },

        setText: function(id, value) {
            var element = document.getElementById(id);
            if (element && value !== null && value !== undefined) {
                element.textContent = value;
            }
        },

        applyCategorySeo: function(category) {
            if (!category) return;
            this.captureOriginalSeo();
            var introSection = document.getElementById('jp-leaderboard-seo-intro');
            if (introSection) introSection.hidden = false;
            document.title = category.seoTitle || category.h1 || category.label || document.title;

            var canonical = document.head.querySelector('link[rel="canonical"]');
            if (!canonical) {
                canonical = document.createElement('link');
                canonical.setAttribute('rel', 'canonical');
                canonical.setAttribute('data-jp-bxh-dynamic', '1');
                document.head.appendChild(canonical);
            }
            canonical.setAttribute('href', category.url || window.location.href);

            this.upsertMeta('meta[name="description"]', {name: 'description'}, category.seoDescription);
            this.upsertMeta('meta[property="og:title"]', {property: 'og:title'}, category.seoTitle);
            this.upsertMeta('meta[property="og:description"]', {property: 'og:description'}, category.seoDescription);
            this.upsertMeta('meta[property="og:url"]', {property: 'og:url'}, category.url);
            this.upsertMeta('meta[property="og:image"]', {property: 'og:image'}, category.ogImage);
            this.upsertMeta('meta[name="twitter:title"]', {name: 'twitter:title'}, category.seoTitle);
            this.upsertMeta('meta[name="twitter:description"]', {name: 'twitter:description'}, category.seoDescription);
            this.upsertMeta('meta[name="twitter:image"]', {name: 'twitter:image'}, category.ogImage);

            this.setText('jp-page-primary-title', category.h1);
            this.setText('jp-leaderboard-heading', category.h1);
            this.setText('jp-leaderboard-intro', category.intro);
            this.setText('jp-leaderboard-breadcrumb', category.h1);
        },

        restoreOriginalSeo: function() {
            var original = this._originalSeo;
            if (!original) return;
            var introSection = document.getElementById('jp-leaderboard-seo-intro');
            if (introSection && original.introSectionHidden !== null) {
                introSection.hidden = original.introSectionHidden;
            }
            document.title = original.title;

            var canonical = document.head.querySelector('link[rel="canonical"]');
            if (canonical) {
                if (original.canonical === null && canonical.getAttribute('data-jp-bxh-dynamic') === '1') {
                    canonical.remove();
                } else if (original.canonical !== null) {
                    canonical.setAttribute('href', original.canonical);
                }
            }

            this.restoreMeta('meta[name="description"]', original.description);
            this.restoreMeta('meta[property="og:title"]', original.ogTitle);
            this.restoreMeta('meta[property="og:description"]', original.ogDescription);
            this.restoreMeta('meta[property="og:url"]', original.ogUrl);
            this.restoreMeta('meta[property="og:image"]', original.ogImage);
            this.restoreMeta('meta[name="twitter:title"]', original.twitterTitle);
            this.restoreMeta('meta[name="twitter:description"]', original.twitterDescription);
            this.restoreMeta('meta[name="twitter:image"]', original.twitterImage);
            this.setText('jp-page-primary-title', original.primaryTitle);
            this.setText('jp-leaderboard-heading', original.heading);
            this.setText('jp-leaderboard-intro', original.intro);
            this.setText('jp-leaderboard-breadcrumb', original.breadcrumb);
        },

        historyPayload: function(path) {
            return {
                category: this.state.activeCategory,
                searchQuery: this.state.searchQuery || '',
                nhom: this.state.nhom || '',
                currentPage: this.state.currentPage || 1,
                isCategoryRoute: !!this.isCategoryRoute,
                path: path || window.location.pathname
            };
        },

        writeHistory: function(mode, targetUrl) {
            if (!window.history || !window.history[mode + 'State']) return;
            var url = targetUrl || window.location.href;
            var path = window.location.pathname;
            try {
                path = new URL(url, window.location.origin).pathname;
            } catch (error) {}
            var state = (window.history.state && typeof window.history.state === 'object')
                ? Object.assign({}, window.history.state)
                : {};
            state.jpLeaderboard = this.historyPayload(path);
            window.history[mode + 'State'](state, '', url);
        },

        initializeRouteState: function(initialCategory, isCategoryRoute) {
            this.captureOriginalSeo();
            var firstId = this.categories[0]?.id || '';
            this.state.activeCategory = this.getCategory(initialCategory) ? initialCategory : firstId;
            this.state.currentPage = 1;
            this.state.searchQuery = '';
            this.isCategoryRoute = !!isCategoryRoute;

            var saved = window.history && window.history.state
                ? window.history.state.jpLeaderboard
                : null;
            if (saved && saved.path === window.location.pathname && this.getCategory(saved.category)) {
                this.state.activeCategory = saved.category;
                this.state.searchQuery = saved.searchQuery || '';
                this.state.nhom = saved.nhom || '';
                this.state.currentPage = Math.max(1, parseInt(saved.currentPage, 10) || 1);
                this.isCategoryRoute = !!saved.isCategoryRoute;
            }

            $('#jp-search-input').val(this.state.searchQuery);
            var active = this.getCategory(this.state.activeCategory);
            if (this.isCategoryRoute) this.applyCategorySeo(active);
            this.writeHistory('replace', window.location.href);
        },

        // Thanh lọc nhóm ultra. Tab nào không có nhóm thì giấu hẳn, không hiện
        // thanh rỗng — người đọc sẽ tưởng đang hỏng.
        // Ultra = cự ly có chia nhóm. Dùng chung một dấu hiệu với thanh lọc nhóm
        // để hai chỗ không bao giờ lệch nhau.
        laUltra: function() {
            var cat = this.getCategory(this.state.activeCategory);
            return !!(cat && Array.isArray(cat.nhoms) && cat.nhoms.length);
        },

        // «100.00» → «100 km». Bỏ số 0 thừa cho gọn cột.
        kmDep: function(v) {
            var n = parseFloat(v);
            if (!isFinite(n) || n <= 0) return '';
            return String(Math.round(n * 100) / 100) + ' km';
        },

        // Số kiểu Việt: 11496 → «11.496».
        soVn: function(v) {
            var n = Math.round(parseFloat(v));
            if (!isFinite(n)) return '';
            return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        },

        // Ô ⓘ cạnh tiêu đề cột — bấm mở bảng giải thích cách chia nhóm và chấm điểm.
        nutGiaiThich: function() {
            return '<button type="button" class="jp-cot-i" data-gt="1" aria-label="Giải thích">i</button>';
        },

        renderNhomBar: function() {
            var self = this;
            var cat = this.getCategory(this.state.activeCategory);
            var $bar = $('#jp-nhom-bar');

            // Tab không thuộc nhóm nào (FM/HM/TRI) ⇒ khỏi hỏi máy chủ.
            if (!cat || !Array.isArray(cat.nhoms) || !cat.nhoms.length) {
                $bar.attr('hidden', true);
                return;
            }

            // MÁY CHỦ quyết nhóm nào có người; WordPress chỉ thêm câu chú thích
            // khoảng km. Đóng cứng danh sách ở đây thì nhóm rỗng vẫn bày ra, mà
            // bấm vào chỉ thấy trắng trơn rồi tưởng hỏng.
            var catId = cat.id;
            $.ajax({
                url: this.ajaxUrl(), type: 'GET', dataType: 'json',
                data: { action: 'jp_bxh_nhom', event: catId },
                timeout: 8000
            }).done(function (res) {
                if (self.state.activeCategory !== catId) return;
                var list = (res && res.data) || [];
                if (!list.length && window.VBM_FALLBACK_DATA && window.VBM_FALLBACK_DATA.nhom && window.VBM_FALLBACK_DATA.nhom[catId]) {
                    list = window.VBM_FALLBACK_DATA.nhom[catId].data || [];
                }
                self.drawNhomBar(cat, list);
            }).fail(function () {
                if (self.state.activeCategory !== catId) return;
                var fb = window.VBM_FALLBACK_DATA && window.VBM_FALLBACK_DATA.nhom && window.VBM_FALLBACK_DATA.nhom[catId];
                if (fb && Array.isArray(fb.data)) {
                    self.drawNhomBar(cat, fb.data);
                } else {
                    $bar.attr('hidden', true);
                }
            });
        },

        drawNhomBar: function(cat, coNguoi) {
            var $bar = $('#jp-nhom-bar');

            // Chỉ một nhóm có người thì lọc chẳng để làm gì — «Tất cả» và nhóm
            // đó ra cùng một bảng. Giấu luôn cho gọn.
            this._nhomDaCo = coNguoi;

            if (coNguoi.length < 2) { $bar.attr('hidden', true); return; }

            // Chú thích khoảng km lấy từ cấu hình WP, khớp theo mã.
            var goiY = {};
            (cat.nhoms || []).forEach(function (n) { goiY[n.ma || ''] = n.hint || ''; });

            var cur = this.state.nhom || '';

            // Nhóm đang chọn biến mất (vừa xoá mét leo chẳng hạn) ⇒ về «Tất cả».
            if (cur && !coNguoi.some(function (n) { return n.ma === cur; })) {
                this.state.nhom = cur = '';
            }

            var ds = [{ ma: '', ten: 'Tất cả', total: 0 }].concat(coNguoi);
            var html = '';
            var hint = goiY[''] || '';

            for (var i = 0; i < ds.length; i++) {
                var n = ds[i];
                var on = (n.ma || '') === cur;
                if (on) hint = goiY[n.ma || ''] || '';
                html += '<button type="button" class="jp-nhom-btn' + (on ? ' active' : '') + '"'
                      + ' data-nhom="' + n.ma + '">'
                      + $('<i>').text(n.ten).html()
                      + (n.total ? ' <span class="jp-nhom-count">' + n.total + '</span>' : '')
                      + '</button>';
            }

            $('#jp-nhom-btns').html(html);
            $('#jp-nhom-note-text').text(hint || 'Cách chia cự ly');
            $('#jp-nhom-note').removeAttr('hidden');
            $bar.removeAttr('hidden');
        },

        // Bảng giải thích cách chia nhóm. Dựng lại mỗi lần mở để cột «đang xem»
        // và số người luôn khớp với thứ người dùng vừa bấm.
        moGiaiThich: function() {
            var cat = this.getCategory(this.state.activeCategory);
            if (!cat) return;

            var loai = /ROAD/i.test(cat.event || '') ? 'road' : 'trail';
            $('#jp-nhom-modal [data-loai]').each(function () {
                $(this).attr('hidden', $(this).data('loai') !== loai ? true : null);
            });
            $('#jp-gt-title').text(loai === 'road'
                ? 'Cự ly đường nhựa được chia thế nào'
                : 'Cự ly đường núi được chia thế nào');

            var goiY = {};
            (cat.nhoms || []).forEach(function (n) { goiY[n.ma || ''] = n.hint || ''; });

            var cur = this.state.nhom || '';
            var rows = '';
            (this._nhomDaCo || []).forEach(function (n) {
                rows += '<tr class="' + (n.ma === cur ? 'on' : '') + '">'
                     +  '<td><span class="nm">' + $('<i>').text(n.ten).html() + '</span>'
                     +  '<div class="kh">' + $('<i>').text(goiY[n.ma] || '').html() + '</div></td>'
                     +  '<td class="r">' + n.total + ' VĐV</td></tr>';
            });
            $('#jp-gt-nhom').html(rows);

            $('#jp-nhom-modal').removeAttr('hidden');
            $('body').css('overflow', 'hidden');
        },

        dongGiaiThich: function() {
            $('#jp-nhom-modal').attr('hidden', true);
            $('body').css('overflow', '');
        },

        // Map 1 row JSON từ Laravel → object widget đang dùng
        mapRow: function(r, categoryId) {
            // CLB: mảng clubs (chính + phụ) → HTML; chính ở dòng đầu, phụ nhạt hơn (CSS .jp-club-container)
            function _esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
            var _clubsArr = Array.isArray(r.clubs) ? r.clubs
                : (r.club ? (Array.isArray(r.club) ? r.club : [r.club]) : []);
            var _clubLinks = (typeof JPClubLinks !== 'undefined' && JPClubLinks) ? JPClubLinks : {};
            var clubName = _clubsArr.map(function(c){
                var nm = (c && typeof c === 'object') ? (c.name || '') : c;
                if (!nm) return '';
                var uid = (c && typeof c === 'object') ? (c.club_uid || '') : '';
                var url = uid && _clubLinks[uid] ? _clubLinks[uid] : '';
                var inner = url
                    ? '<a href="' + _esc(url) + '" class="jp-club-link">' + _esc(nm) + '</a>'
                    : _esc(nm);
                return '<div>' + inner + '</div>';
            }).join('');
            return {
                category: categoryId || this.state.activeCategory,
                rank: r.rank_live || r.rank || 0,
                avatarId: r.vbm_id || '',
                mark: r.mark || '',
                race: r.race || '',
                raceDay: r.race_day || '',
                sexAge: r.sex || '',
                pace: r.pace || '',
                km: r.distance_km || '',
                // Ultra: cự ly thật · mét leo · km quy đổi · điểm (máy chủ tính sẵn,
                // đúng con số đã dùng để xếp hạng).
                ultra: r.ultra || null,
                club: clubName,
                name: r.full_name || r.vbm_id || '',
                stars: parseInt(r.star) || 0,
                facebookUrl: '',
                badges: Array.isArray(r.badges) ? r.badges : [],
                vbmId: r.vbm_id || '',
                // Lưu tạm: VĐV chưa xác minh chỉ ở lại Bảng Vàng có thời hạn.
                // Máy chủ quyết mốc hết hạn (config/bang_vang.php), client chỉ đếm.
                verified: r.verified !== false,
                verifyDeadline: r.verify_deadline || '',
                verifyUrl: r.verify_url || '',
                swim: r.swim_time || '',
                bike: r.bike_time || '',
                run: r.run_time || '',
                rawRow: null
            };
        },

        loadPage: function() {
            var self = this;
            if (this._xhr && this._xhr.readyState !== 4) {
                this._xhr.abort();
            }
            this._loading = true;
            var requestSeq = ++this._requestSeq;
            var requestCategory = this.state.activeCategory;
            $('#jp-table-body').html('<div class="py-12 text-center text-slate-500 text-sm">Đang tải…</div>');

            var useFallbackList = function() {
                var fb = window.VBM_FALLBACK_DATA && window.VBM_FALLBACK_DATA.lists && window.VBM_FALLBACK_DATA.lists[requestCategory];
                if (!fb || !Array.isArray(fb.data)) {
                    $('#jp-table-body').html('<div class="py-12 text-center text-slate-500 text-sm">Không tải được dữ liệu.</div>');
                    self._totalPages = 1; self.renderPagination(0);
                    return;
                }
                var rows = fb.data.slice();
                if (self.state.nhom) {
                    var nhomKey = self.state.nhom;
                    rows = rows.filter(function(r) {
                        return r.ultra && (r.ultra.ma_nhom === nhomKey || r.ultra.nhom === nhomKey);
                    });
                }
                var q = (self.state.searchQuery || '').trim().toLowerCase();
                if (q) {
                    var qNorm = self.normalizeVietnamese(q);
                    rows = rows.filter(function(r) {
                        var nm = self.normalizeVietnamese(r.full_name || r.vbm_id || '');
                        var idN = self.normalizeVietnamese(r.vbm_id || '');
                        var cl = self.normalizeVietnamese((r.club && r.club.name) || '');
                        var rc = self.normalizeVietnamese(r.race || r.race_full_name || '');
                        var abbr = self.getAbbreviation(r.full_name || '');
                        return self.calculateSearchScore(nm, cl, rc, abbr, idN, qNorm) > 0;
                    });
                }
                var perPage = 15;
                var total = (!q && !self.state.nhom && fb.total) ? fb.total : rows.length;
                var totalPages = Math.max(1, Math.ceil(rows.length / perPage));
                var cur = Math.min(Math.max(1, self.state.currentPage), totalPages);
                var slice = rows.slice((cur - 1) * perPage, cur * perPage);
                self.data = slice.map(function(r) {
                    var mapped = self.mapRow(r, requestCategory);
                    mapped._rawJson = r;
                    return mapped;
                });
                self._total = total;
                self._totalPages = totalPages;
                self.renderTable();
            };

            this._xhr = $.ajax({
                url: this.ajaxUrl(),
                type: 'GET',
                dataType: 'json',
                timeout: 8000,
                data: {
                    action: 'jp_bxh_list',
                    event: requestCategory,
                    page: this.state.currentPage,
                    per_page: this.state.itemsPerPage,
                    q: this.state.searchQuery || '',
                    nhom: this.state.nhom || ''
                },
                success: function(res) {
                    if (requestSeq !== self._requestSeq) return;
                    self._loading = false;
                    if (!res || !res.data) {
                        useFallbackList();
                        return;
                    }
                    self.data = res.data.map(function(r){
                        var mapped = self.mapRow(r, requestCategory);
                        mapped._rawJson = r;
                        return mapped;
                    });
                    self._total = res.total || self.data.length;
                    self._totalPages = res.total_pages || 1;
                    self.renderTable();
                },
                error: function(xhr, status) {
                    if (requestSeq !== self._requestSeq || status === 'abort') return;
                    self._loading = false;
                    useFallbackList();
                }
            });
        },

        // Rebuild data from sheets (used by refresh button)
        rebuildDataFromSheets: function(sheetsData, categories) {
            const self = this;
            const allData = [];
            const headersByCategory = {};

            Object.keys(sheetsData).forEach(function(category) {
                const rows = sheetsData[category];
                if (rows && rows.length > 0) {
                    // Extract headers from first row
                    if (rows[0]) {
                        const headerRow = rows[0];
                        headersByCategory[category] = {
                            rank: headerRow[0] || '#',
                            competitor: headerRow[13] || 'Competitor',
                            mark: headerRow[2] || 'Mark',
                            race: headerRow[3] || 'Race',
                            raceDay: headerRow[4] || 'Race Day',
                            sexAge: headerRow[5] || 'Sex / Age',
                            pace: headerRow[7] || 'Pace',
                            club: headerRow[10] || 'Club'
                        };
                    }

                    // Skip header row
                    for (let i = 1; i < rows.length; i++) {
                        const row = rows[i];
                        if (!row || row.length === 0) continue;

                        const badgesStr = row[28] || '';
                        const badges = badgesStr.split(',').map(function(b) {
                            return b.trim();
                        }).filter(function(b) {
                            return b.length > 0;
                        });

                        allData.push({
                            category: category,
                            rank: row[0] || i,
                            avatarId: row[1] || '',
                            mark: row[2] || '',
                            race: row[3] || '',
                            raceDay: row[4] || '',
                            sexAge: row[5] || '',
                            pace: row[7] || '',
                            club: row[10] || '',
                            name: row[13] || '',
                            stars: parseInt(row[18]) || 0,
                            facebookUrl: row[27] || '',
                            badges: badges,
                            rawRow: row
                        });
                    }
                }
            });

            // Update data and re-render
            self.data = allData;
            self.headersByCategory = headersByCategory;
            self.state.currentPage = 1;
            self.state.searchQuery = '';

            self.renderHeaders();
            self.renderTable();

            // Show success message
            const $container = $('#jp-leaderboard-container');
            const $msg = $('<div class="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-pulse">✓ Đã cập nhật dữ liệu mới!</div>');
            $('body').append($msg);
            setTimeout(function() { $msg.fadeOut(function() { $msg.remove(); }); }, 3000);
        },

        getDefaultHeaders: function() {
            return {
                rank: '#',
                competitor: 'Competitor',
                mark: 'Mark',
                race: 'Race',
                raceDay: 'Race Day',
                sexAge: 'Sex / Age',
                pace: 'Pace',
                club: 'Club'
            };
        },

        getCurrentHeaders: function() {
            return this.headersByCategory[this.state.activeCategory] || this.getDefaultHeaders();
        },

        renderHeaders: function() {
            const headers = this.getCurrentHeaders();
            const container = $('#jp-table-header');
            const ultra = this.laUltra();

            // Ultra: cột Pace luôn rỗng nên thay bằng KM · KM QUY ĐỔI · ĐIỂM, đặt TRƯỚC
            // Mark. Bảng xếp theo nhóm rồi ĐIỂM — không bày điểm ra thì người xem thấy
            // người chậm hơn đứng trên mà không hiểu vì sao.
            const cotGiua = ultra
                ? `<div class="hidden md:block text-center">KM</div>
                   <div class="hidden md:block text-center jp-cot-2d">KM QUY ĐỔI${this.nutGiaiThich()}</div>
                   <div class="hidden md:block text-center">ĐIỂM${this.nutGiaiThich()}</div>
                   <div class="text-right md:text-left pl-0">${headers.mark}</div>`
                : `<div class="text-right md:text-left pl-0">${headers.mark}</div>`;
            const cotPace = ultra
                ? ''
                : `<div class="hidden md:block text-center">${headers.pace}</div>`;

            container.toggleClass('jp-ultra', ultra);
            container.html(`
                <div class="text-center">${headers.rank}</div>
                <div class="pl-1 text-left">${headers.competitor}</div>
                ${cotGiua}
                <div class="hidden md:block text-center">${headers.race}</div>
                <div class="hidden md:block text-center">${headers.raceDay}</div>
                <div class="hidden md:block text-center">${headers.sexAge}</div>
                ${cotPace}
                <div class="hidden md:block">${headers.club}</div>
            `);
        },

        renderTabs: function() {
            const container = $('#jp-category-tabs');
            const self = this;
            const html = this.categories.map((cat) => {
                const isActive = this.state.activeCategory === cat.id;
                const activeClass = isActive ? 'active' : '';
                const ariaCurrent = isActive ? ' aria-current="page"' : '';
                return `
                    <a class="jp-tab-button ${activeClass}"
                       href="${self.escapeHtml(cat.url || '#')}"
                       data-category="${self.escapeHtml(cat.id)}"${ariaCurrent}>
                        <span>${self.escapeHtml(cat.label)}</span>
                    </a>
                `;
            }).join('');
            const clubUrl = new URL('/clubs-leaderboard/', window.location.origin).href;
            const clubTab = `
                <a class="jp-tab-button jp-club-tab-link"
                   href="${self.escapeHtml(clubUrl)}">
                    <span>BXH CLB</span>
                </a>
            `;
            container.html(html + clubTab);
        },

        getBadgeHtml: function(badgeCode) {
            // Check for KING pattern (KING + year, e.g., KING2025)
            const kingMatch = badgeCode.match(/^KING(\d{4})$/);
            if (kingMatch) {
                const year = kingMatch[1];
                const BadgeIcons = window.JPBadgeIcons || {};
                return `
                    <span class="jp-badge badge-cyan-light" data-tooltip="KING ${year}">
                        ${BadgeIcons.KingCrown || '♔'}
                        <span class="md:hidden text-[8px]">${year}</span>
                        <span class="hidden md:inline text-[10px]">${year}</span>
                    </span>
                `;
            }

            // Check for QUEEN pattern (QUEEN + year, e.g., QUEEN2025)
            const queenMatch = badgeCode.match(/^QUEEN(\d{4})$/);
            if (queenMatch) {
                const year = queenMatch[1];
                const BadgeIcons = window.JPBadgeIcons || {};
                return `
                    <span class="jp-badge badge-pink-light" data-tooltip="QUEEN ${year}">
                        ${BadgeIcons.QueenCrown || '♕'}
                        <span class="md:hidden text-[8px]">${year}</span>
                        <span class="hidden md:inline text-[10px]">${year}</span>
                    </span>
                `;
            }

            // Check for KINGPT pattern (KINGPT + year for Phong Trao, e.g., KINGPT2022)
            const kingPTMatch = badgeCode.match(/^KINGPT(\d{4})$/);
            if (kingPTMatch) {
                const year = kingPTMatch[1];
                const BadgeIcons = window.JPBadgeIcons || {};
                return `
                    <span class="jp-badge badge-cyan-light" data-tooltip="King Marathon Phong Trào ${year}">
                        ${BadgeIcons.KingCrown || '♔'}
                        <span class="md:hidden text-[8px]">${year}</span>
                        <span class="hidden md:inline text-[10px]">${year}</span>
                    </span>
                `;
            }

            // Check for QUEENPT pattern (QUEENPT + year for Phong Trao, e.g., QUEENPT2022)
            const queenPTMatch = badgeCode.match(/^QUEENPT(\d{4})$/);
            if (queenPTMatch) {
                const year = queenPTMatch[1];
                const BadgeIcons = window.JPBadgeIcons || {};
                return `
                    <span class="jp-badge badge-pink-light" data-tooltip="Queen Marathon Phong Trào ${year}">
                        ${BadgeIcons.QueenCrown || '♕'}
                        <span class="md:hidden text-[8px]">${year}</span>
                        <span class="hidden md:inline text-[10px]">${year}</span>
                    </span>
                `;
            }

            // Check for PT pattern (PT + year for Phong Trao, e.g., PT2022)
            const ptMatch = badgeCode.match(/^PT(\d{4})$/);
            if (ptMatch) {
                const year = ptMatch[1];
                const BadgeIcons = window.JPBadgeIcons || {};
                return `
                    <span class="jp-badge badge-orange" data-tooltip="Phong Trào ${year}">
                        ${BadgeIcons.Star || '⭐'}
                        <span class="md:hidden text-[8px]">${year}</span>
                        <span class="hidden md:inline text-[10px]">${year}</span>
                    </span>
                `;
            }

            // Regular badge lookup
            const badge = BadgeConfig[badgeCode];
            if (!badge) {
                // Badge chưa khai báo trong badges-config.js → hiện mã + nhắc thêm config.
                return `<span class="jp-badge" style="background: #fef3c7; border-color: #fde68a; color: #92400e;" data-tooltip="Chưa cấu hình: ${badgeCode}" title="Badge '${badgeCode}' chưa có trong badges-config.js">${badgeCode}</span>`;
            }

            return `
                <span class="jp-badge ${badge.class}" data-tooltip="${badge.fullLabel}" title="${badge.fullLabel}">
                    ${badge.icon}
                    <span class="md:hidden text-[8px]">${badge.label}</span>
                    <span class="hidden md:inline text-[10px]">${badge.label}</span>
                </span>
            `;
        },

        // Get badge HTML for modal (with full text label instead of just icon)
        getBadgeHtmlModal: function(badgeCode) {
            const BadgeIcons = window.JPBadgeIcons || {};

            // Check for KING pattern
            const kingMatch = badgeCode.match(/^KING(\d{4})$/);
            if (kingMatch) {
                const year = kingMatch[1];
                return `<span class="jp-badge badge-cyan-light">
                    ${BadgeIcons.KingCrown || '♔'} KING ${year}
                </span>`;
            }

            // Check for QUEEN pattern
            const queenMatch = badgeCode.match(/^QUEEN(\d{4})$/);
            if (queenMatch) {
                const year = queenMatch[1];
                return `<span class="jp-badge badge-pink-light">
                    ${BadgeIcons.QueenCrown || '♕'} QUEEN ${year}
                </span>`;
            }

            // Check for KINGPT pattern
            const kingPTMatch = badgeCode.match(/^KINGPT(\d{4})$/);
            if (kingPTMatch) {
                const year = kingPTMatch[1];
                return `<span class="jp-badge badge-cyan-light">
                    ${BadgeIcons.KingCrown || '♔'} KING PT ${year}
                </span>`;
            }

            // Check for QUEENPT pattern
            const queenPTMatch = badgeCode.match(/^QUEENPT(\d{4})$/);
            if (queenPTMatch) {
                const year = queenPTMatch[1];
                return `<span class="jp-badge badge-pink-light">
                    ${BadgeIcons.QueenCrown || '♕'} QUEEN PT ${year}
                </span>`;
            }

            // Check for PT pattern
            const ptMatch = badgeCode.match(/^PT(\d{4})$/);
            if (ptMatch) {
                const year = ptMatch[1];
                return `<span class="jp-badge badge-orange">
                    ${BadgeIcons.Star || '⭐'} PT ${year}
                </span>`;
            }

            // Regular badge lookup
            const badge = BadgeConfig[badgeCode];
            if (!badge) {
                return `<span class="jp-badge" style="background: #fef3c7; border-color: #fde68a; color: #92400e;">${badgeCode}</span>`;
            }

            return `<span class="jp-badge ${badge.class}">
                ${badge.icon} ${badge.fullLabel}
            </span>`;
        },

        parseBadges: function(badgeString) {
            if (!badgeString) return [];
            // Split by comma and trim
            return badgeString.split(',').map(b => b.trim()).filter(b => b.length > 0);
        },

        // Địa chỉ kho + luật bỏ dấu/viết hoa nằm ở assets/kho-anh.js — một chỗ cho
        // cả ba màn hình. Giữ tên hàm này vì nhiều chỗ trong tệp đang gọi.
        generateAvatarUrl: function(name) {
            return JPKhoAnh.vdv(name);
        },

        // ── Thành tích LƯU TẠM ────────────────────────────────────────────────
        //
        // VĐV chưa xác minh thì thành tích chỉ ở lại Bảng Vàng có thời hạn, tính
        // từ ngày thi đấu. Hết hạn là dòng rơi khỏi bảng — không ai báo trước.
        //
        // Mốc hết hạn do MÁY CHỦ quyết (`verify_deadline`, xem config/bang_vang.php)
        // chứ không tự cộng ngày ở đây: số ngày còn nằm trong câu lọc của lệnh đồng
        // bộ, hai nơi tự tính là đồng hồ chạy về 0 trong khi dòng vẫn còn, hoặc
        // ngược lại.

        /** Còn bao lâu tới mốc. Trả '' khi đã tới hạn. */
        conLai: function (den) {
            var ms = new Date(den).getTime() - Date.now();
            if (!isFinite(ms) || ms <= 0) return '';

            // Dạng NGÀY:GIỜ:PHÚT:GIÂY — "2:00:41:22". Gọn hơn hẳn "2 ngày 00:41:22",
            // mà cả khối chỉ nằm trong một ô hẹp cạnh tên nên từng ký tự đều đắt.
            var giay = Math.floor(ms / 1000);
            var ngay = Math.floor(giay / 86400);
            var hai = function (n) { return n < 10 ? '0' + n : '' + n; };
            var dongHo = hai(Math.floor(giay % 86400 / 3600)) + ':'
                       + hai(Math.floor(giay % 3600 / 60)) + ':'
                       + hai(giay % 60);

            return ngay > 0 ? ngay + ':' + dongHo : dongHo;
        },

        /** Chữ trên đồng hồ. Nói THỨ SẼ XẢY RA, không chỉ nói còn mấy ngày. */
        chuDongHo: function (den) {
            var conLai = this.conLai(den);
            return conLai ? 'Thành tích sẽ ẩn sau ' + conLai : 'Thành tích sắp ẩn';
        },

        /** "7/9/2026" từ mốc ISO. */
        ngayVietNam: function (den) {
            var d = new Date(den);
            return isFinite(d.getTime())
                ? d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear()
                : '';
        },

        /**
         * Khối "chờ xác minh". Trả '' khi VĐV đã xác minh — đó là lối ra duy nhất,
         * nên người đã xác minh không có đồng hồ lẫn dòng chữ nào trong trang.
         *
         * @param gon true = chip trong bảng, false = khối trong hộp chi tiết
         */
        luuTamHtml: function (runner, gon) {
            if (!runner || runner.verified !== false) return '';
            var den = runner.verifyDeadline || '';
            if (!den) return '';   // giải không có ngày → không có hạn

            var url = runner.verifyUrl || '';
            var dongHo = '<span class="jp-cxm-dh" data-luutam-den="' + this.escapeHtml(den) + '">'
                + this.chuDongHo(den) + '</span>';

            if (gon) {
                var nut = url
                    ? '<a class="jp-cxm-nut" href="' + this.escapeHtml(url) + '" target="_blank" rel="noopener">Xác minh</a>'
                    : '';
                // Chỉ đồng hồ + nút. Nhãn "chờ xác minh" đã bỏ: nó thừa với chính
                // cái nút ngay cạnh, mà thêm vào là chip dài quá cột và xuống dòng,
                // đẩy cao cả hàng trong bảng.
                return '<div class="jp-cxm jp-cxm--bang">' + dongHo + nut + '</div>';
            }

            var ngay = this.ngayVietNam(den);
            var nutHop = url
                ? '<a class="jp-cxm-nut jp-cxm-nut--to" href="' + this.escapeHtml(url) + '" target="_blank" rel="noopener">Xác minh thành tích</a>'
                : '';

            // Ngắn nhất mà vẫn đủ ba điều người xem cần biết: khi nào, chuyện gì,
            // và có lấy lại được không.
            // Không nhắc lại "sẽ ẩn" lần nữa ở câu dưới — đồng hồ nói rồi.
            return '<div class="jp-cxm-dau">Chờ xác minh</div>'
                + '<div class="jp-cxm-dhto">' + dongHo + '</div>'
                + '<p class="jp-cxm-chu">Xác minh lúc nào cũng hiện lại'
                + (ngay ? ' <span class="jp-cxm-ngay">(hạn ' + ngay + ')</span>' : '')
                + '.</p>'
                + nutHop;
        },

        /**
         * Một bộ đếm duy nhất cho cả trang, quét lại DOM mỗi giây.
         *
         * Cố ý không gắn bộ đếm theo từng dòng: bảng vẽ lại mỗi lần đổi trang hoặc
         * gõ tìm kiếm, mà bộ đếm gắn vào dòng đã bị thay thì không ai dọn — chạy
         * mãi trên phần tử không còn trong trang.
         */
        batDauDemNguoc: function () {
            if (this._demNguoc) return;
            var self = this;
            this._demNguoc = setInterval(function () {
                document.querySelectorAll('[data-luutam-den]').forEach(function (el) {
                    var den = el.getAttribute('data-luutam-den');
                    el.textContent = self.chuDongHo(den);
                    if (!self.conLai(den)) el.classList.add('jp-cxm-het');
                });
            }, 1000);
        },

        renderTable: function() {
            const filtered = this.getFilteredData();
            const paged = this.getPagedData(filtered);

            const container = $('#jp-table-body');
            this.batDauDemNguoc();

            if (paged.length === 0) {
                container.html('<div class="py-12 text-center text-slate-500 text-sm">No runners found.</div>');
                this.renderPagination(0);
                return;
            }

            const html = paged.map((runner, index) => {
                let rankDisplay = `<span style="font-weight: 400; color: rgb(100, 116, 139); font-size: 14px; display: block; text-align: center;">${runner.rank}</span>`;
                if (runner.rank <= 3) {
                    rankDisplay = `<img src="https://bestmarathon.vn/wp-content/plugins/jp-google-sheet-api-5/images/top${runner.rank}.png" style="width: 38px; height: auto; margin: 0 auto; display: block;">`;
                }

                const starsHtml = runner.stars ? `<div class="jp-stars">${Array(runner.stars).fill(Icons.StarFill).join('')}</div>` : '';

                // Mã rỗng thì vdv() trả '' — để nguyên vào src="" là trình duyệt
                // đi tải lại chính trang HTML này cho MỖI dòng thiếu ảnh.
                const avatarUrl = this.generateAvatarUrl(runner.avatarId)
                    || JPKhoAnh.anhThayThe(runner.name, 44);

                // Club column supports HTML content
                const clubHtml = runner.club || '';
                const clubsHtml = clubHtml; // Render as-is to support HTML tags

                const badgesHtml = runner.badges.map(b => this.getBadgeHtml(b)).join('');

                // TRI: splits bơi/đạp/chạy (icon line đơn sắc, xếp dọc)
                const _icoSwim = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-1px;flex-shrink:0;"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>';
                const _icoBike = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;flex-shrink:0;"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>';
                const _icoRun = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-1px;flex-shrink:0;"><path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/></svg>';
                const splitRow = (ico, t) => `<div style="display:flex; align-items:center; gap:4px; white-space:nowrap;">${ico}<span>${t || '—'}</span></div>`;
                const splitsHtml = (runner.swim || runner.bike || runner.run)
                    ? `<div class="jp-tri-splits" style="font-size:10px; color:rgb(100,116,139); margin-top:3px; font-family:monospace; line-height:1.6;">
                            ${splitRow(_icoSwim, runner.swim)}
                            ${splitRow(_icoBike, runner.bike)}
                            ${splitRow(_icoRun, runner.run)}
                       </div>`
                    : '';

                // Check if Facebook URL exists - link avatar to Facebook
                const hasFacebookUrl = runner.facebookUrl && runner.facebookUrl.trim() !== '';
                const avatarHtml = hasFacebookUrl
                    ? `<a href="${runner.facebookUrl}" target="_blank" rel="nofollow noopener noreferrer" class="jp-avatar-link jp-avatar-img" style="display: block; width: 44px; height: 44px; border-radius: 50%; overflow: hidden; border: 1px solid rgb(226, 232, 240); box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); transition: all 0.2s;" onmouseover="this.style.borderColor='rgb(59, 130, 246)'; this.style.boxShadow='0 0 0 2px rgba(59, 130, 246, 0.2)';" onmouseout="this.style.borderColor='rgb(226, 232, 240)'; this.style.boxShadow='0 1px 2px 0 rgba(0, 0, 0, 0.05)';">
                        <img src="${avatarUrl}" alt="${this.escapeHtml(runner.name || '')}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy" onerror="JPKhoAnh.hong(this, null, 44)">
                    </a>`
                    : `<div class="jp-avatar-img" style="width: 44px; height: 44px; border-radius: 50%; overflow: hidden; border: 1px solid rgb(226, 232, 240); box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
                        <img src="${avatarUrl}" alt="${this.escapeHtml(runner.name || '')}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy" onerror="JPKhoAnh.hong(this, null, 44)">
                    </div>`;

                // Store runner index for click handling
                const startIndex = (this.state.currentPage - 1) * this.state.itemsPerPage;
                const dataIndex = this.laravelMode ? index : (startIndex + index);

                // Ultra: cột KM thay cột Pace (luôn rỗng) và đứng trước Mark.
                const _ultra = this.laUltra();
                const _u = _ultra ? (runner.ultra || {}) : {};
                const _kmTxt = _ultra ? this.kmDep(_u.cu_ly_km || runner.km) : '';
                const _leoTxt = _u.leo_m ? '+' + this.soVn(_u.leo_m) + ' m' : '';
                // «tạm» = giải chưa khai mét leo, km quy đổi đang là km trần.
                const _kqTxt = _u.km_quy_doi ? this.soVn(_u.km_quy_doi) + (_u.tam ? '*' : '') : '';
                const _diemTxt = _u.diem != null ? this.soVn(_u.diem) : '';
                const _oKm = _ultra
                    ? `<div class="hidden md:block" style="text-align: center; font-size: 13px; font-weight: 600; color: rgb(51, 65, 85); font-family: monospace; line-height: 1.25;">${_kmTxt}${_leoTxt ? `<div style="font-size: 10px; font-weight: 500; color: rgb(100, 116, 139);">${_leoTxt}</div>` : ''}</div>
                       <div class="hidden md:block" style="text-align: center; font-size: 13px; font-weight: 600; color: rgb(51, 65, 85); font-family: monospace;"${_u.tam ? ' title="Giải chưa có số mét leo — đang tính bằng km trần"' : ''}>${_kqTxt}</div>
                       <div class="hidden md:block" style="text-align: center; font-size: 14px; font-weight: 800; color: rgb(180, 83, 9); font-family: monospace;">${_diemTxt}</div>`
                    : '';
                // Điện thoại không có cột — gói vào dòng nhỏ dưới thành tích. Giữ NGẮN:
                // cột giờ trên điện thoại co theo nội dung, dòng dài là đẩy giờ ra
                // khỏi màn hình (đo ở khổ 390px). Cự ly thật, mét leo, tên giải xem ở chi tiết.
                const _dongNho = _ultra
                    ? (_diemTxt ? _diemTxt + ' điểm' : '')
                    : (runner.race || '');

                return `
                <div class="jp-leaderboard-row${_ultra ? ' jp-ultra' : ''} group relative" data-runner-index="${dataIndex}">
                    <div style="display: flex; align-items: center; justify-content: center;">${rankDisplay}</div>
                    <div class="jp-competitor-cell" style="display: flex; align-items: center; gap: 0.5rem; padding-right: 0.25rem;">
                        <div class="jp-avatar-wrapper" style="flex-shrink: 0;">
                            ${avatarHtml}
                        </div>
                        <div style="display: flex; flex-direction: column; min-width: 0; flex: 1;">
                            ${starsHtml}
                            <div style="display: flex; align-items: center; gap: 0.375rem; flex-wrap: wrap;">
                                <h3 style="font-size: 13px; font-weight: 500; text-transform: uppercase; color: rgb(30, 41, 59); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;">${runner.name || ''}</h3>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.2rem; margin-top: 0.15rem; flex-wrap: wrap;">
                                ${badgesHtml}
                            </div>
                            ${this.luuTamHtml(runner, true)}
                        </div>
                    </div>
                    ${_oKm}
                    <div class="jp-mark-cell">
                        <div class="jp-mark-time" style="font-size: 13px; font-weight: 700; color: rgb(15, 23, 42);">${runner.mark || ''}</div>
                        <div class="jp-mark-race md:hidden" style="font-size: 10px; font-weight: 500; color: rgb(71, 85, 105); text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px;">${_dongNho}</div>
                        ${splitsHtml}
                    </div>
                    <div class="hidden md:block" style="text-align: center; font-size: 10px; font-weight: 500; color: rgb(71, 85, 105); text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${runner.race || ''}</div>

                    <div class="hidden md:block" style="text-align: center; font-size: 13px; color: rgb(100, 116, 139); font-family: monospace;">${runner.raceDay || ''}</div>
                    <div class="hidden md:block" style="text-align: center; font-size: 13px; font-weight: 500; color: rgb(71, 85, 105);">${runner.sexAge || ''}</div>
                    ${_ultra ? '' : `<div class="hidden md:block" style="text-align: center; font-size: 13px; color: rgb(71, 85, 105); font-family: monospace;">${runner.pace || ''}</div>`}
                    <div class="hidden md:block jp-club-container">${clubsHtml}</div>
                </div>`;
            }).join('');

            container.html(html);
            this.renderPagination(this.laravelMode ? this._totalPages : Math.ceil(filtered.length / this.state.itemsPerPage));
        },

        renderPagination: function(totalPages) {
            const container = $('#jp-pagination-container');
            if (totalPages <= 1) {
                container.html('');
                return;
            }

            const current = Math.min(Math.max(1, this.state.currentPage), totalPages);
            let pages = [];

            // Cửa sổ số trang rộng hơn (±1) + luôn có trang 1 và trang cuối
            if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
            } else if (current <= 4) {
                pages = [1, 2, 3, 4, 5, '...', totalPages];
            } else if (current >= totalPages - 3) {
                pages = [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
            } else {
                pages = [1, '...', current - 1, current, current + 1, '...', totalPages];
            }

            const navBtn = (page, inner, disabled, title) =>
                `<button class="jp-page-nav" data-page="${page}" ${disabled ? 'disabled' : ''} title="${title}">${inner}</button>`;

            const numbers = pages.map(p => {
                if (p === '...') return '<span style="padding: 0 0.35rem; color: rgb(148, 163, 184);">…</span>';
                return `<button class="jp-page-btn ${p === current ? 'active' : ''}" data-page="${p}">${p}</button>`;
            }).join('');

            const html = `
                ${navBtn(1, '&laquo;', current === 1, 'Trang đầu')}
                ${navBtn(current - 1, Icons.ChevronLeft, current === 1, 'Trước')}
                <div style="display: flex; align-items: center; gap: 0.25rem;">${numbers}</div>
                ${navBtn(current + 1, Icons.ChevronRight, current === totalPages, 'Sau')}
                ${navBtn(totalPages, '&raquo;', current === totalPages, 'Trang cuối')}
                <span class="jp-page-jump" style="display:inline-flex; align-items:center; gap:6px; margin-left:8px; font-size:13px; color:rgb(71,85,105);">
                    <span class="hidden md:inline">Tới trang</span>
                    <input type="number" class="jp-page-input" min="1" max="${totalPages}" value="${current}"
                           style="width:56px; height:36px; text-align:center; border:1px solid rgb(226,232,240); border-radius:8px; font-weight:700;">
                    <span>/ ${totalPages}</span>
                </span>
            `;
            container.html(html);
        },

        // Cuộn mượt lên đầu bảng khi đổi trang (tránh "nhảy" lung tung)
        scrollToTable: function() {
            var el = document.getElementById('jp-leaderboard-new');
            if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },

        goToPage: function(page, totalPages) {
            page = parseInt(page, 10);
            if (isNaN(page)) return;
            page = Math.min(Math.max(1, page), totalPages || this._totalPages || 1);
            if (page === this.state.currentPage) return;
            this.state.currentPage = page;
            this.writeHistory('replace', window.location.href);
            this.scrollToTable();
            if (this.laravelMode) { this.loadPage(); } else { this.renderTable(); }
        },

        // Normalize Vietnamese text (remove diacritics)
        normalizeVietnamese: function(str) {
            if (!str) return '';
            return str
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/đ/g, 'd')
                .replace(/Đ/g, 'D')
                .toLowerCase();
        },

        // Get abbreviation from name (first letter of each word)
        getAbbreviation: function(name) {
            if (!name) return '';
            return name
                .split(/\s+/)
                .map(word => word.charAt(0))
                .join('')
                .toLowerCase();
        },

        // Check if all words in query exist in text (order doesn't matter)
        // "nguyen thanh ngoc" will match "Nguyen Ngoc Thanh"
        matchAllWords: function(textNorm, queryNorm) {
            if (!textNorm || !queryNorm) return false;
            const textWords = textNorm.split(/\s+/);
            const queryWords = queryNorm.split(/\s+/).filter(w => w.length > 0);

            if (queryWords.length === 0) return false;

            // All query words must match a text word (text word starts with query word, or exact match)
            // Fixed: "thanh" should NOT match "ha" (previously "thanh".includes("ha") was true)
            return queryWords.every(qWord =>
                textWords.some(tWord => tWord === qWord || tWord.startsWith(qWord))
            );
        },

        // Calculate search relevance score (100 = best match, 0 = no match)
        calculateSearchScore: function(nameNorm, clubNorm, raceNorm, nameAbbr, avatarIdNorm, qNormalized) {
            // 100: Exact name match
            if (nameNorm === qNormalized) return 100;

            // 95: Name starts with query
            if (nameNorm.startsWith(qNormalized)) return 95;

            // 92: ID (column B) exact match
            if (avatarIdNorm && avatarIdNorm === qNormalized) return 92;

            // 90: Exact abbreviation match
            if (nameAbbr === qNormalized) return 90;

            // 85: Name contains query as whole word
            const nameWords = nameNorm.split(/\s+/);
            if (nameWords.includes(qNormalized)) return 85;

            // 80: All query words match in name (any order)
            if (this.matchAllWords(nameNorm, qNormalized)) return 80;

            // 75: ID (column B) contains query
            if (avatarIdNorm && avatarIdNorm.includes(qNormalized)) return 75;

            // 70: Name contains query substring
            if (nameNorm.includes(qNormalized)) return 70;

            // 60: Abbreviation contains query
            if (nameAbbr.includes(qNormalized)) return 60;

            // 50: Club exact match
            if (clubNorm === qNormalized) return 50;

            // 40: Club contains query
            if (clubNorm.includes(qNormalized)) return 40;

            // 30: Race contains query
            if (raceNorm.includes(qNormalized)) return 30;

            return 0; // No match
        },

        getFilteredData: function() {
            // Laravel mode: data đã được lọc/phân trang ở server.
            if (this.laravelMode) return this.data;

            let filtered = this.data;

            // Filter by category
            if (this.state.activeCategory) {
                filtered = filtered.filter(r => r.category === this.state.activeCategory);
            }

            // Filter by search (smart search with Vietnamese normalization + abbreviation + word match)
            const q = this.state.searchQuery.trim().toLowerCase();
            if (q) {
                const qNormalized = this.normalizeVietnamese(q);
                const self = this;

                // Calculate score for each item and filter
                filtered = filtered.map(r => {
                    const name = r.name || '';
                    const club = (r.club || '').replace(/<[^>]*>/g, ' '); // bỏ tag/URL, chỉ tìm theo tên CLB
                    const race = r.race || '';

                    const nameNorm = self.normalizeVietnamese(name);
                    const clubNorm = self.normalizeVietnamese(club);
                    const raceNorm = self.normalizeVietnamese(race);
                    const nameAbbr = self.getAbbreviation(name);
                    const avatarIdNorm = self.normalizeVietnamese(r.avatarId || '');

                    const score = self.calculateSearchScore(nameNorm, clubNorm, raceNorm, nameAbbr, avatarIdNorm, qNormalized);
                    return { ...r, _searchScore: score };
                }).filter(r => r._searchScore > 0);

                // Sort by score (highest first), then by original rank
                filtered.sort((a, b) => {
                    if (b._searchScore !== a._searchScore) {
                        return b._searchScore - a._searchScore;
                    }
                    return parseInt(a.rank) - parseInt(b.rank);
                });
            }

            return filtered;
        },

        getPagedData: function(data) {
            if (this.laravelMode) return data; // server đã phân trang
            const start = (this.state.currentPage - 1) * this.state.itemsPerPage;
            return data.slice(start, start + this.state.itemsPerPage);
        },

        setupEventListeners: function() {
            const self = this;
            if (this._eventsBound) return;
            this._eventsBound = true;

            // Category tabs: href thật cho SEO/no-JS, AJAX + History API cho UX nhanh.
            $(document).on('click', '.jp-tab-button', function(e) {
                if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || (e.which && e.which !== 1)) {
                    return;
                }
                var category = self.getCategory($(this).data('category'));
                if (!category) return;

                e.preventDefault();
                if (self.isCategoryRoute && self.state.activeCategory === category.id) return;

                self.state.activeCategory = category.id;
                self.state.currentPage = 1;
                self.state.nhom = '';   // nhóm của tab cũ vô nghĩa ở tab mới
                self.isCategoryRoute = true;
                self.applyCategorySeo(category);
                self.writeHistory('push', category.url || $(this).attr('href'));
                self.renderHeaders();
                self.renderTabs();
                self.renderNhomBar();
                if (self.laravelMode) { self.loadPage(); } else { self.renderTable(); }
            });

            // Bấm nhóm: lọc lại từ trang 1.
            $(document).on('click', '.jp-nhom-btn', function() {
                var ma = String($(this).data('nhom') || '');
                if (ma === (self.state.nhom || '')) return;
                self.state.nhom = ma;
                self.state.currentPage = 1;
                $('#jp-nhom-btns .jp-nhom-btn').each(function () {
                    $(this).toggleClass('active', String($(this).data('nhom') || '') === ma);
                });

                // Chú thích đi theo nhóm vừa chọn, kẻo nó còn mô tả nhóm cũ.
                var cat = self.getCategory(self.state.activeCategory);
                var hint = '';
                (cat && cat.nhoms || []).forEach(function (n) {
                    if ((n.ma || '') === ma) hint = n.hint || '';
                });
                $('#jp-nhom-note-text').text(hint || 'Cách chia cự ly');
                self.writeHistory('replace', window.location.href);
                if (self.laravelMode) { self.loadPage(); } else { self.renderTable(); }
            });

            // Giải thích cách chia cự ly: mở từ chú thích, đóng bằng X / nền / Esc.
            $(document).on('click', '#jp-nhom-note', function() { self.moGiaiThich(); });
            $(document).on('click', '.jp-cot-i', function(e) { e.preventDefault(); e.stopPropagation(); self.moGiaiThich(); });
            $(document).on('click', '#jp-gt-close', function() { self.dongGiaiThich(); });
            $(document).on('click', '#jp-nhom-modal', function(e) {
                if (e.target === this) self.dongGiaiThich();   // bấm nền, không phải trong hộp
            });
            $(document).on('keydown', function(e) {
                if (e.key === 'Escape' && !$('#jp-nhom-modal').attr('hidden')) self.dongGiaiThich();
            });

            // Back/Forward khôi phục cả tab, từ khóa và trang mà không reload.
            window.addEventListener('popstate', function(event) {
                var saved = event.state && event.state.jpLeaderboard;
                if (!saved || !self.getCategory(saved.category)) return;

                self.state.activeCategory = saved.category;
                self.state.searchQuery = saved.searchQuery || '';
                self.state.nhom = saved.nhom || '';
                self.state.currentPage = Math.max(1, parseInt(saved.currentPage, 10) || 1);
                self.isCategoryRoute = !!saved.isCategoryRoute;
                $('#jp-search-input').val(self.state.searchQuery);
                self.renderNhomBar();

                if (self.isCategoryRoute) {
                    self.applyCategorySeo(self.getCategory(self.state.activeCategory));
                } else {
                    self.restoreOriginalSeo();
                }

                self.renderHeaders();
                self.renderTabs();
                if (self.laravelMode) { self.loadPage(); } else { self.renderTable(); }
            });

            // Pagination
            $(document).on('click', '.jp-page-btn, .jp-page-nav', function() {
                if ($(this).prop('disabled')) return;
                self.goToPage($(this).data('page'), self._totalPages);
            });

            // Ô nhảy trang: Enter hoặc rời ô → tới trang đó (tự kẹp 1..N)
            $(document).on('keydown', '.jp-page-input', function(e) {
                if (e.key === 'Enter') { e.preventDefault(); self.goToPage($(this).val(), self._totalPages); }
            });
            $(document).on('change', '.jp-page-input', function() {
                self.goToPage($(this).val(), self._totalPages);
            });

            // Search
            $('#jp-search-input').on('input', function() {
                self.state.searchQuery = $(this).val();
                self.state.currentPage = 1;
                self.writeHistory('replace', window.location.href);
                if (self.laravelMode) {
                    clearTimeout(self._searchTimer);
                    self._searchTimer = setTimeout(function(){ self.loadPage(); }, 350);
                } else {
                    self.renderTable();
                }
            });

            // Row click - open modal
            $(document).on('click', '.jp-leaderboard-row', function(e) {
                // Don't open modal if clicking on Facebook link
                if ($(e.target).closest('.jp-fb-link').length) return;

                const filtered = self.getFilteredData();
                const index = parseInt($(this).data('runner-index'));
                const runner = filtered[index];
                if (!runner) return;

                if (self.laravelMode) {
                    self.openModalLaravel(runner);
                } else if (runner.rawRow) {
                    self.openModal(runner.rawRow, runner);
                }
            });

            // ========================================
            // NÚT LÀM MỚI - Refresh data từ Google Sheets
            // Gọi tuần tự từng sheet qua AJAX (chuẩn WP)
            // ========================================
            const COOLDOWN_KEY = 'jp_refresh_cooldown';
            const COOLDOWN_TIME = 5 * 60 * 1000;

            function getRemainingCooldown() {
                var last = localStorage.getItem(COOLDOWN_KEY);
                if (!last) return 0;
                var remaining = COOLDOWN_TIME - (Date.now() - parseInt(last));
                if (remaining <= 0) { localStorage.removeItem(COOLDOWN_KEY); return 0; }
                return remaining;
            }

            function updateBtnState() {
                var $btn = $('#jp-refresh-btn');
                var remaining = getRemainingCooldown();
                if (remaining > 0) {
                    $btn.prop('disabled', true).addClass('opacity-50 cursor-not-allowed');
                    $btn.attr('title', 'Chờ ' + Math.ceil(remaining / 1000) + 's');
                    setTimeout(updateBtnState, 1000);
                } else {
                    $btn.prop('disabled', false).removeClass('opacity-50 cursor-not-allowed');
                    $btn.attr('title', 'Cập nhật dữ liệu mới nhất');
                }
            }
            updateBtnState();

            // Hàm gọi refresh tuần tự từng sheet (tránh quá tải server)
            function refreshSheetsSequentially(sheetIds, ajaxUrl, nonce, callback) {
                var results = {};
                var index = 0;

                function next() {
                    if (index >= sheetIds.length) {
                        callback(results);
                        return;
                    }
                    var sheetId = sheetIds[index];
                    $.ajax({
                        url: ajaxUrl,
                        type: 'POST',
                        timeout: 90000, // 90s mỗi sheet
                        data: {
                            action: 'jp_refresh_single_sheet',
                            sheet: sheetId,
                            nonce: nonce
                        },
                        success: function(response) {
                            if (response.success && response.data) {
                                results[sheetId] = response.data;
                            }
                        },
                        complete: function() {
                            index++;
                            next();
                        }
                    });
                }

                next();
            }

            $('#jp-refresh-btn').on('click', function() {
                var $btn = $(this);
                if (getRemainingCooldown() > 0) return;

                localStorage.setItem(COOLDOWN_KEY, Date.now().toString());

                var categories = self.state.categories || [];
                if (!categories.length) { location.reload(); return; }

                var sheetIds = categories.map(function(c) { return c.id; });
                var ajaxUrl = window.jpgs?.ajax_url || '/wp-admin/admin-ajax.php';
                var nonce = window.jpgs?.nonce || '';

                // Loading state
                var originalHtml = $btn.html();
                $btn.prop('disabled', true).html(
                    '<svg class="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">' +
                    '<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>' +
                    '<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>' +
                    '</svg>'
                );

                // Clear search
                self.state.searchQuery = '';
                $('#jp-search-input').val('');
                self.state.currentPage = 1;
                self.writeHistory('replace', window.location.href);

                // Gọi refresh tuần tự từng sheet
                refreshSheetsSequentially(sheetIds, ajaxUrl, nonce, function(results) {
                    $btn.html(originalHtml);

                    if (Object.keys(results).length > 0) {
                        // Cập nhật bảng với data mới
                        self.rebuildDataFromSheets(results, categories);
                    } else {
                        alert('Google Sheets API không phản hồi. Vui lòng thử lại sau vài phút.');
                    }

                    updateBtnState();
                });
            });
        },

        // Laravel mode: fetch chi tiết VĐV → dựng rawRow (theo cột sheet) → tái dùng openModal
        openModalLaravel: function(runner) {
            var self = this;
            var renderAthleteRows = function(rows) {
                    if (!rows || !rows.length) return;

                    var byEv = {};
                    rows.forEach(function(r){ byEv[r.event] = r; });

                    var evMap = {
                        'FMM':'FMM','FMF':'FMF','HMM':'HMM','HMF':'HMF',
                        'IRON':'TRI70','TRI703':'TRI70','TRI70':'TRI70',
                        'FULLIRON':'TRI140','IRONFULL':'TRI140','TRI1406':'TRI140','TRI140':'TRI140',
                        'ROAD100':'ULTRA_ROAD','ROAD':'ULTRA_ROAD','ULTRAROAD':'ULTRA_ROAD',
                        'ULTRATRAIL':'ULTRA_TRAIL','TRAIL':'ULTRA_TRAIL','TRAIL100':'ULTRA_TRAIL'
                    };
                    var ek = (self.state.activeCategory || '').toUpperCase().replace(/[^A-Z0-9]/g,'');
                    var activeEv = evMap[ek] || rows[0].event;
                    var p = byEv[activeEv] || rows[0]; // primary row hiển thị

                    // "rank/total,time" cho card cự ly (định dạng modal đang parse)
                    function tline(ev) {
                        var r = byEv[ev]; if (!r) return '';
                        var rk = (r.rank_live || r.rank || '') + '/' + (r.total_live || r.rank_total || '');
                        return rk + ',' + (r.mark || '');
                    }
                    // FM/HM gộp 2 giới — lấy cái nào có
                    var fm = tline('FMM') || tline('FMF');
                    var hm = tline('HMM') || tline('HMF');

                    var row = [];
                    row[1]  = p.vbm_id || '';                 // B avatarId
                    row[2]  = p.mark || '';                   // C mark
                    row[4]  = p.race_day || '';               // E race day
                    row[5]  = p.sex || '';                    // F sex/age
                    row[6]  = p.bib || '';                    // G bib
                    row[8]  = p.result_url || '';             // I result link
                    row[9]  = p.vbm_id || '';                 // J id
                    // Team: tất cả CLB (chính + phụ), ngăn bằng dấu phẩy
                    function _eTeam(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
                    var _clubsArr = Array.isArray(p.clubs) ? p.clubs
                        : (p.club ? (Array.isArray(p.club) ? p.club : [p.club]) : []);
                    var _team = _clubsArr.map(function(c){
                        var nm = (c && typeof c === 'object') ? (c.name || '') : c;
                        return nm ? '<div>' + _eTeam(nm) + '</div>' : '';
                    }).filter(Boolean).join('');
                    row[10] = _team;                          // K team (chính + phụ, xếp dọc)
                    row[11] = p.achievements_highlight || ''; // L thành tích
                    row[12] = p.race_full_name || p.race || '';// M race name
                    row[13] = p.full_name || p.vbm_id || '';  // N name
                    row[18] = p.star || 0;                    // S star
                    row[19] = p.sub || '';                    // T sub
                    row[21] = fm;                             // V time FM
                    row[22] = hm;                             // W time HM
                    row[23] = tline('TRI70');                 // X time TRI70.3
                    row[24] = tline('ULTRA_TRAIL');           // Y trail
                    row[25] = tline('ULTRA_ROAD');            // Z road
                    row[31] = tline('TRI140');                // AF iron full

                    // Rank thật từ API (rank_in_event/total_in_event) cho chứng nhận + modal —
                    // KHÔNG đếm số dòng đã tải (this.data tối đa itemsPerPage=100 → ra "1/100" sai).
                    runner.__certRank  = p.rank || p.rank_live || runner.rank || '';
                    runner.__certTotal = p.rank_total || p.total_live || '';
                    // Tên file huy hiệu do API quyết định (ULTRA = mốc cự ly, còn lại = mốc
                    // thời gian). Không có thì openModal tự suy ra từ cột T như cũ.
                    runner.__subBadge  = p.sub_badge || '';

                    self.openModal(row, runner);

                    // Điền TOP3 + thành tích đạt chuẩn (mảng) + ẩn dòng rỗng
                    var modalEl = document.getElementById('jp_googlesheet_api-modal');
                    if (modalEl) {
                        var escL = function(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };
                        // Parse "TOP n - event - tên giải - dd/mm/yyyy" → pill rank + tên + ngày
                        var fmtTop3 = function(s){
                            s = String(s);
                            var m = s.match(/^TOP\s*(\d+)\s*-\s*([\s\S]+)$/);
                            var rank = m ? m[1] : '';
                            var rest = m ? m[2] : s;
                            rest = rest.replace(/\s*-\s*\d{1,2}\/\d{1,2}\/\d{4}\s*$/, ''); // bỏ ngày cuối (đã có ngày)
                            var rcls = rank === '1' ? 'jp-t3-1' : rank === '2' ? 'jp-t3-2' : rank === '3' ? 'jp-t3-3' : '';
                            return '<div class="jp-t3">'
                                + (rank ? '<span class="jp-t3-rank ' + rcls + '">TOP ' + escL(rank) + '</span>' : '')
                                + '<span class="jp-t3-txt">' + escL(rest) + '</span>'
                                + '</div>';
                        };
                        // other_results_full = object {time, rank, total, bib, race, is_pr}.
                        // Fallback chuỗi cũ "[time - bib - giải]" nếu API chưa trả field mới.
                        var fmtOther = function(o){
                            if (typeof o === 'string') {
                                var t = o.replace(/^\s*\[|\]\s*$/g, '');
                                var parts = t.split(' - ');
                                var ftime = (parts[0] || '').trim();
                                var frace = parts.slice(2).join(' - ').trim() || (parts[1] || '').trim();
                                return '<div class="jp-other"><b class="jp-other-time">' + escL(ftime) + '</b>'
                                    + (frace ? '<span class="jp-other-race">' + escL(frace) + '</span>' : '') + '</div>';
                            }
                            var isPR = !!(o && o.is_pr);
                            // rank/total = hạng trên BXH cự ly TẠI NGÀY ĐUA, đóng băng —
                            // API tính sẵn, mỗi giải một con số riêng và không đổi về sau.
                            // Giải không có ngày thì API trả null: ẩn hạng, đừng bịa số khác.
                            var rank = (o && o.rank != null && o.total != null) ? (o.rank + '/' + o.total) : '';
                            var race = (o && o.race) || '';
                            // Ultra: một dòng «km, leo → km quy đổi · tốc độ · điểm · nhóm» để
                            // người xem hiểu kết quả này nặng cỡ nào và được bao nhiêu điểm.
                            var u = o && o.ultra;
                            var dongU = '';
                            if (u) {
                                var kq = self.soVn(u.km_quy_doi);
                                dongU = '<div class="jp-other-ultra">'
                                    + escL(self.kmDep(u.cu_ly_km))
                                    + (u.leo_m ? ', leo ' + self.soVn(u.leo_m) + ' m → ' + kq + ' km quy đổi' : (u.tam ? ' (chưa có số mét leo)' : ''))
                                    + (u.toc_do ? ' · ' + String(u.toc_do).replace('.', ',') + ' km/giờ' : '')
                                    + (u.diem != null ? ' · <b>' + self.soVn(u.diem) + ' điểm</b>' : '')
                                    + (u.nhom ? ' · ' + escL(u.nhom) : '')
                                    + '</div>';
                            }
                            return '<div class="jp-other' + (isPR ? ' jp-other--pr' : '') + '">'
                                + '<b class="jp-other-time">' + escL((o && o.time) || '') + '</b>'
                                + (rank ? '<span class="jp-other-rank">#' + escL(rank) + '</span>' : '')
                                + (isPR ? '<span class="jp-other-pr-badge">PR</span>' : '')
                                + (race ? '<span class="jp-other-race">' + escL(race) + '</span>' : '')
                                + dongU
                                + '</div>';
                        };
                        var fillList = function(target, arr, fmt){
                            var el = modalEl.querySelector('[data-target="'+target+'"]');
                            if (!el) return;
                            arr = Array.isArray(arr) ? arr.filter(Boolean) : [];
                            el.innerHTML = arr.map(fmt).join('');
                        };
                        // Khối lưu tạm: ẩn hẳn khi VĐV đã xác minh (html rỗng).
                        var oLuuTam = modalEl.querySelector('[data-target="__luu_tam"]');
                        if (oLuuTam) {
                            var htmlLuuTam = self.luuTamHtml({
                                verified: p.verified !== false,
                                verifyDeadline: p.verify_deadline || '',
                                verifyUrl: p.verify_url || ''
                            }, false);
                            oLuuTam.innerHTML = htmlLuuTam;
                            oLuuTam.hidden = !htmlLuuTam;
                        }

                        fillList('__top3', p.top3_achievements, fmtTop3);
                        fillList('__other_results', p.other_results_full || p.other_results, fmtOther);
                        // Ẩn phần thành tích rỗng (không có thì không hiển thị) — gồm cả <tr> lẫn block <div>
                        modalEl.querySelectorAll('.jp-ach-row').forEach(function(node){
                            var cell = node.querySelector('[data-target]');
                            node.style.display = (!cell || cell.textContent.trim() === '') ? 'none' : '';
                        });
                    }
            };

            var fallbackAthlete = function() {
                var fbAth = window.VBM_FALLBACK_DATA && window.VBM_FALLBACK_DATA.athletes && window.VBM_FALLBACK_DATA.athletes[runner.vbmId];
                if (fbAth && Array.isArray(fbAth.data) && fbAth.data.length) {
                    renderAthleteRows(fbAth.data);
                    return;
                }
                // Synthesize from all loaded category lists for this athlete
                var synth = [];
                if (window.VBM_FALLBACK_DATA && window.VBM_FALLBACK_DATA.lists) {
                    Object.keys(window.VBM_FALLBACK_DATA.lists).forEach(function(k) {
                        var l = window.VBM_FALLBACK_DATA.lists[k];
                        if (l && Array.isArray(l.data)) {
                            l.data.forEach(function(item) {
                                if (item.vbm_id === runner.vbmId) synth.push(item);
                            });
                        }
                    });
                }
                if (!synth.length && runner._rawJson) synth.push(runner._rawJson);
                renderAthleteRows(synth);
            };

            $.ajax({
                url: this.ajaxUrl(),
                type: 'GET',
                dataType: 'json',
                timeout: 8000,
                data: { action: 'jp_bxh_athlete', vbm_id: runner.vbmId },
                success: function(res) {
                    var rows = (res && res.data) ? res.data : [];
                    if (rows.length) {
                        renderAthleteRows(rows);
                    } else {
                        fallbackAthlete();
                    }
                },
                error: function() {
                    fallbackAthlete();
                }
            });
        },

        // Open modal with runner data
        openModal: function(row, runner) {
            var self = this; // Store reference to JPLeaderboardNew for callbacks
            const jp_modal = document.getElementById('jp_googlesheet_api-modal');
            if (!jp_modal) return;

            // Update certificate background based on current category
            const ju_chungnhan = jp_modal.querySelector('.ju_chungnhan');
            if (ju_chungnhan) {
                const baseUrl = ju_chungnhan.dataset.url || '';
                const category = runner.category || this.state.activeCategory || '';
                // Ảnh cert: lấy tên file từ config category (field cert), fallback = id.
                let certName = category;
                const catObj = (this.categories || []).find(c => c.id === category);
                if (catObj && catObj.cert) certName = catObj.cert;
                if (baseUrl && certName) {
                    // Mã hoá + bọc nháy: tên file có dấu cách mà để trần thì url() sai
                    // cú pháp CSS → mất sạch ảnh nền, không báo lỗi gì.
                    ju_chungnhan.style.backgroundImage =
                        'url("' + baseUrl + encodeURIComponent(certName) + '.jpg")';
                    // Đánh dấu đang dùng phôi nào, để CSS chỉnh vị trí chữ cho phôi
                    // có bố cục lệch (xem .ju_chungnhan[data-cert=...] trong custom.css).
                    ju_chungnhan.dataset.cert = certName;
                }
            }

            // Helper function to get column data
            const getCol = (col) => {
                let index = 0;
                for (let i = 0; i < col.length; i++) {
                    index = index * 26 + (col.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
                }
                return row[index - 1] || '';
            };

            // Fill modal data
            // Huy hiệu: ưu tiên tên file từ API (sub_badge), fallback mốc thời gian cột T.
            const subValue = getCol('T'); // Column T (index 19) for sub image
            const subStem = runner.__subBadge || (subValue ? 'sub' + subValue : '');
            const subImgUrl = subStem ? (window.jpgs?.source_image_path || '') + 'sub/' + subStem + '.png' : '';

            const data = {
                __name: getCol('N'),
                __id: getCol('J'),
                __sexage: getCol('F'),
                // Không có mã ở cột B thì vẽ ảnh thay thế. Trước đây rơi về
                // 'default.jpg' — tệp đó chưa từng tồn tại ở kho nào.
                __img: JPKhoAnh.vdv(getCol('B')) || JPKhoAnh.anhThayThe(getCol('N'), 100),
                __subimg: subImgUrl,
                __star: parseInt(getCol('S')) || 0,
                __race: getCol('M'),
                __race_day: getCol('E'),
                __bib: getCol('G'),
                __mark: getCol('C'),
                __result_link: getCol('I'),
                __team: getCol('K'),
                __thanh_tich: getCol('L'),
                __time_42: getCol('V'),
                __time_21: getCol('W'),
                __time_tri: getCol('X'),
                __time_ultra_trail: getCol('Y'),
                __time_ultra_road: getCol('Z'),
                __time_iron_full: getCol('AF'),
                __danh_hieu: runner.badges || [], // Use badges array from runner
                __tengiai: getCol('M')
            };

            // Rank/total LẤY TỪ API (rank_in_event/total_in_event). Fallback đếm dòng đã tải
            // chỉ dùng cho chế độ Google Sheet legacy (không có __certTotal).
            const certTotal = runner.__certTotal || this.data.filter(r => r.category === runner.category).length;
            const certRank  = runner.__certRank || runner.rank;
            data.__rank_value = certRank + '/' + certTotal;

            // Fill data into modal
            for (const target in data) {
                jp_modal.querySelectorAll('[data-target="' + target + '"]').forEach(item => {
                    item.replaceChildren();

                    if (target === '__img') {
                        const image = document.createElement('img');
                        image.setAttribute('uk-cover', '');
                        image.setAttribute('src', data[target]);
                        image.onerror = function() { JPKhoAnh.hong(this, data.__name, 100); };
                        item.appendChild(image);
                        item.classList.add('uk-cover-container');
                    } else if (target === '__subimg') {
                        // Set src attribute for sub image (badge/achievement icon).
                        // PHẢI xoá src khi không có huy hiệu — nếu không, VĐV sau sẽ
                        // đeo lại huy hiệu của VĐV vừa xem.
                        // Ẩn bằng visibility, TUYỆT ĐỐI KHÔNG display:none — ảnh này cao
                        // 65px và nằm trong dòng chảy; mất 65px đó thì tên VĐV, thời gian
                        // và tên giải bên dưới trượt lên, lệch hết so với phôi in sẵn.
                        item.onerror = function () { this.removeAttribute('src'); this.style.visibility = 'hidden'; };
                        if (data[target]) {
                            item.style.visibility = '';
                            item.setAttribute('src', data[target]);
                        } else {
                            item.removeAttribute('src');
                            item.style.visibility = 'hidden';
                        }
                    } else if (target === '__star') {
                        const diem = parseInt(data[target]);
                        if (!isNaN(diem) && diem > 0 && diem <= 10) {
                            for (let i = 0; i < diem; i++) {
                                const star_icon = document.createElement('span');
                                star_icon.setAttribute('uk-icon', 'icon: star');
                                item.appendChild(star_icon);
                            }
                        }
                    } else if (target === '__thanh_tich') {
                        const strings = (data[target] || '').toString();
                        const parts = strings.split('<br>');
                        parts.forEach(part => {
                            const child = document.createElement('div');
                            child.innerHTML = part;
                            item.appendChild(child);
                        });
                    } else if (['__time_42', '__time_21', '__time_tri', '__time_ultra_trail', '__time_ultra_road', '__time_iron_full'].includes(target)) {
                        const rawValue = data[target] || '';
                        const achMatch = rawValue.match(/^(\d+\/\d+),(.+)$/);
                        const card = item.closest('.bm-ach-card');

                        if (achMatch) {
                            item.textContent = achMatch[2];
                            const achData = item.closest('.bm-ach-data');
                            if (achData) {
                                const rankBadge = achData.querySelector('.bm-rank');
                                const rankValue = achData.querySelector('.bm-rank-val');
                                if (rankValue) rankValue.textContent = achMatch[1];
                                if (rankBadge) rankBadge.style.display = 'inline-flex';
                            }
                            if (card) card.classList.remove('bm-no-data');
                        } else if (target === '__time_iron_full') {
                            item.textContent = 'Pending';
                            if (card) card.classList.add('bm-no-data');
                        } else if (rawValue.trim()) {
                            item.textContent = rawValue;
                            if (card) card.classList.add('bm-no-data');
                        } else {
                            item.textContent = '—';
                            if (card) card.classList.add('bm-no-data');
                        }
                    } else if (target === '__danh_hieu') {
                        // Render badges for danh_hieu in modal (with full text)
                        const badges = data[target];
                        if (Array.isArray(badges) && badges.length > 0) {
                            const badgesHtml = badges.map(b => this.getBadgeHtmlModal(b)).join(' ');
                            item.innerHTML = badgesHtml;
                        } else {
                            item.textContent = '—';
                        }
                    } else {
                        item.innerHTML = data[target];
                    }
                });
            }

            // Show modal using UIkit
            if (window.UIkit) {
                const modalEl = document.getElementById('jp_googlesheet_api-modal');
                UIkit.modal(modalEl).show();

                // Scale certificate after modal is fully shown
                UIkit.util.on(modalEl, 'shown', function() {
                    self.scaleCertificate();
                    self.fitCertName();
                });

                // Also try with timeout as fallback
                setTimeout(function() {
                    self.scaleCertificate();
                    self.fitCertName();
                }, 300);
            }

            // Handle VIP section visibility
            this.handleVipSection(runner, data);
        },

        // Handle VIP section - check badge and show/hide content
        handleVipSection: function(runner, data) {
            const vipLocked = document.getElementById('jp-vip-locked');
            const vipContent = document.getElementById('jp-vip-content');
            const vipCardBadge = document.getElementById('jp-vip-card-badge');
            const vipCertBadge = document.getElementById('jp-vip-cert-badge');

            // Check if user has VIP badge
            const badges = runner.badges || [];

            const hasVip = badges.some(badge =>
                badge && (badge.toLowerCase().includes('vip') || badge === 'VIP')
            );

            // Show/hide VIP badges on Profile Card and Certificate
            if (vipCardBadge) {
                vipCardBadge.style.display = hasVip ? 'block' : 'none';
            }
            if (vipCertBadge) {
                vipCertBadge.style.display = hasVip ? 'block' : 'none';
            }

            // Show VIP telemetry for VIP athletes or membership overview for non-VIP

            if (!vipLocked || !vipContent) return;

            if (hasVip) {
                // Show VIP content, hide locked message
                vipLocked.style.display = 'none';
                vipContent.style.display = 'block';

                // Fill VIP section data
                this.fillVipAchievements(data, runner);
            } else {
                // Show locked message, hide VIP content
                vipLocked.style.display = 'block';
                vipContent.style.display = 'none';
            }
        },

        // Fill VIP section with data (new standalone.html design)
        fillVipAchievements: function(data, runner) {
            const modal = document.getElementById('jp_googlesheet_api-modal');
            if (!modal) return;

            // Parse rank value (format: "rank/total")
            const rankValue = data.__rank_value || '';
            const rankMatch = rankValue.match(/^(\d+)\/(\d+)$/);

            const vipRank = modal.querySelector('[data-target="__vip_rank"]');
            const vipRankTotal = modal.querySelector('[data-target="__vip_rank_total"]');

            if (rankMatch) {
                if (vipRank) vipRank.textContent = '#' + rankMatch[1];
                if (vipRankTotal) vipRankTotal.textContent = '/ ' + rankMatch[2];
            } else {
                if (vipRank) vipRank.textContent = '#—';
                if (vipRankTotal) vipRankTotal.textContent = '/ —';
            }

            // Check if user has API token
            const apiToken = runner.apiToken || '';

            if (apiToken) {
                // Fetch stats from API
                this.fetchStravaStats(apiToken);
                // Fetch activities from API
                this.fetchStravaActivities(apiToken);
            } else {
                // Set placeholder values if no token
                this.setPlaceholderStats();
                this.setPlaceholderActivities();
            }

            // Parse and display photos from column AE
            const galleryGrid = modal.querySelector('#jp-vip-gallery-grid');
            if (galleryGrid) {
                const photosStr = runner.photos || '';
                if (photosStr) {
                    const photoUrls = photosStr.split(',').map(function(url) {
                        return url.trim();
                    }).filter(function(url) {
                        return url.length > 0;
                    });

                    if (photoUrls.length > 0) {
                        galleryGrid.innerHTML = photoUrls.map(function(url) {
                            return `
                                <div class="jp-vip-gallery-item">
                                    <img src="${url}" alt="Photo" loading="lazy" onerror="this.parentElement.remove()">
                                </div>
                            `;
                        }).join('');
                    } else {
                        galleryGrid.innerHTML = '<div class="jp-vip-gallery-empty">Chưa có ảnh</div>';
                    }
                } else {
                    galleryGrid.innerHTML = '<div class="jp-vip-gallery-empty">Chưa có ảnh</div>';
                }
            }
        },

        // Set placeholder stats when no API token
        setPlaceholderStats: function() {
            const modal = document.getElementById('jp_googlesheet_api-modal');
            if (!modal) return;

            const kmWeek = modal.querySelector('[data-target="__vip_km_week"]');
            const kmMonth = modal.querySelector('[data-target="__vip_km_month"]');
            const kmQuarter = modal.querySelector('[data-target="__vip_km_quarter"]');
            const kmYear = modal.querySelector('[data-target="__vip_km_year"]');

            if (kmWeek) kmWeek.textContent = '—';
            if (kmMonth) kmMonth.textContent = '—';
            if (kmQuarter) kmQuarter.textContent = '—';
            if (kmYear) kmYear.textContent = '—';
        },

        // Set placeholder activities when no API token
        setPlaceholderActivities: function() {
            const modal = document.getElementById('jp_googlesheet_api-modal');
            if (!modal) return;

            const activityList = modal.querySelector('#jp-vip-activity-list');
            if (activityList) {
                activityList.innerHTML = '<div class="jp-vip-activity-empty">Chưa có dữ liệu hoạt động</div>';
            }

            const stravaLink = modal.querySelector('#jp-vip-strava-link');
            if (stravaLink) stravaLink.style.display = 'none';
        },

        // Fetch Strava stats from API
        fetchStravaStats: function(apiToken) {
            const modal = document.getElementById('jp_googlesheet_api-modal');
            if (!modal) return;

            const apiUrl = `https://my.bestmarathon.vn/api/public/strava/${apiToken}/stats`;

            fetch(apiUrl)
                .then(response => response.json())
                .then(result => {
                    if (result.success && result.data && result.data.stats) {
                        const stats = result.data.stats;

                        // Calculate current week (last 7 days from 1month data)
                        const kmWeek = modal.querySelector('[data-target="__vip_km_week"]');
                        if (kmWeek && stats['1month']) {
                            // Approximate: 1month / 4 for weekly
                            const weekKm = (stats['1month'].distance / 4).toFixed(1);
                            kmWeek.textContent = weekKm;
                        }

                        // 1 month
                        const kmMonth = modal.querySelector('[data-target="__vip_km_month"]');
                        if (kmMonth && stats['1month']) {
                            kmMonth.textContent = stats['1month'].distance.toFixed(1);
                        }

                        // 3 months (quarter)
                        const kmQuarter = modal.querySelector('[data-target="__vip_km_quarter"]');
                        if (kmQuarter && stats['3months']) {
                            kmQuarter.textContent = stats['3months'].distance.toFixed(1);
                        }

                        // Current year
                        const kmYear = modal.querySelector('[data-target="__vip_km_year"]');
                        const currentYear = new Date().getFullYear().toString();
                        if (kmYear && stats[currentYear]) {
                            kmYear.textContent = stats[currentYear].distance.toFixed(1);
                        } else if (kmYear) {
                            kmYear.textContent = '0';
                        }
                    }
                })
                .catch(err => {
                    console.error('Failed to fetch Strava stats:', err);
                    this.setPlaceholderStats();
                });
        },

        // Fetch Strava activities from API
        fetchStravaActivities: function(apiToken) {
            const modal = document.getElementById('jp_googlesheet_api-modal');
            if (!modal) return;

            const activityList = modal.querySelector('#jp-vip-activity-list');
            const stravaLink = modal.querySelector('#jp-vip-strava-link');

            if (!activityList) return;

            // Show loading
            activityList.innerHTML = '<div class="jp-vip-activity-empty">Đang tải...</div>';

            const apiUrl = `https://my.bestmarathon.vn/api/public/strava/${apiToken}/activities?limit=5`;

            fetch(apiUrl)
                .then(response => response.json())
                .then(result => {
                    if (result.success && result.data && result.data.activities) {
                        const activities = result.data.activities;

                        if (activities.length === 0) {
                            activityList.innerHTML = '<div class="jp-vip-activity-empty">Chưa có dữ liệu hoạt động</div>';
                            return;
                        }

                        // Render activities
                        activityList.innerHTML = activities.map(function(activity) {
                            return `
                                <div class="jp-vip-activity-item">
                                    <div class="jp-vip-activity-header">
                                        <strong>${activity.name || 'Run'}</strong>
                                        <span>${activity.date_display || ''}</span>
                                    </div>
                                    <div class="jp-vip-activity-stats">
                                        <span>📏 ${activity.distance_km} km</span>
                                        <span>⏱️ ${activity.duration}</span>
                                        <span>⚡ ${activity.pace}/km</span>
                                    </div>
                                </div>
                            `;
                        }).join('');

                        // Show Strava link if we have user's Strava profile URL
                        if (stravaLink && result.data.user && result.data.user.strava_profile_url) {
                            stravaLink.style.display = 'flex';
                            stravaLink.href = result.data.user.strava_profile_url;
                        }
                    } else {
                        activityList.innerHTML = '<div class="jp-vip-activity-empty">Chưa có dữ liệu hoạt động</div>';
                    }
                })
                .catch(err => {
                    console.error('Failed to fetch Strava activities:', err);
                    activityList.innerHTML = '<div class="jp-vip-activity-empty">Không thể tải dữ liệu</div>';
                });
        },

        // Scale certificate to fit mobile screens
        scaleCertificate: function() {
            const modal = document.getElementById('jp_googlesheet_api-modal');
            if (!modal) return;

            const ju_chungnhan_wrap = modal.querySelector('.ju_chungnhan_wrap');
            const ju_chungnhan = modal.querySelector('.ju_chungnhan');
            if (!ju_chungnhan_wrap || !ju_chungnhan) return;

            // Original certificate size
            const originalWidth = 815;
            const originalHeight = 490;

            // Get modal content width for calculation
            const modalContent = modal.querySelector('.jp_ggs_modal_content');
            let availableWidth = window.innerWidth - 40; // Default: screen width minus margins

            if (modalContent) {
                const contentWidth = modalContent.clientWidth || modalContent.offsetWidth;
                if (contentWidth > 0) {
                    availableWidth = contentWidth - 20; // minus padding
                }
            }

            // Calculate scale ratio (never more than 1)
            const scale = Math.min(availableWidth / originalWidth, 1);

            // Apply scale transform
            ju_chungnhan.style.transform = 'scale(' + scale + ')';
            ju_chungnhan.style.transformOrigin = 'top left';

            // Set wrapper height to match scaled certificate
            const scaledHeight = originalHeight * scale;
            ju_chungnhan_wrap.style.height = scaledHeight + 'px';
            ju_chungnhan_wrap.style.width = (originalWidth * scale) + 'px';
            ju_chungnhan_wrap.style.margin = '0 auto';
        },

        // Fit certificate name: scaleX to fit without affecting layout
        fitCertName: function() {
            var modal = document.getElementById('jp_googlesheet_api-modal');
            if (!modal) return;

            // Name: scaleX using canvas measurement (no DOM dependency)
            var nameEl = modal.querySelector('.ju_chungnhan [data-target="__name"]');
            if (nameEl) {
                nameEl.style.transform = '';
                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d');
                var cs = window.getComputedStyle(nameEl);
                ctx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
                var textWidth = ctx.measureText(nameEl.textContent).width;
                var available = 395; // 815(cert) - 295(ju_first) - 90(pad-left) - 35(pad-right)
                if (textWidth > available) {
                    nameEl.style.transform = 'scaleX(' + (available / textWidth) + ')';
                }
            }

            // Race name: reduce font-size to fit max 2 lines
            var raceEl = modal.querySelector('.ju_chungnhan [data-target="__tengiai"]');
            if (raceEl) {
                raceEl.style.fontSize = '';
                var canvas2 = document.createElement('canvas');
                var ctx2 = canvas2.getContext('2d');
                var cs2 = window.getComputedStyle(raceEl);
                ctx2.font = cs2.fontWeight + ' 20px ' + cs2.fontFamily;
                var raceWidth = ctx2.measureText(raceEl.textContent).width;
                var maxWidth = available * 1.7; // 2 lines (0.3 buffer for word-wrap)
                if (raceWidth > maxWidth) {
                    var newSize = Math.floor(20 * maxWidth / raceWidth);
                    raceEl.style.fontSize = newSize + 'px';
                }
            }

            // Rank & Time: reduce font-size together for long rank numbers
            var rankEl = modal.querySelector('.ju_chungnhan [data-target="__rank_value"]');
            var markEl = modal.querySelector('.ju_chungnhan [data-target="__mark"]');
            if (rankEl) {
                var text = (rankEl.textContent || '').trim();
                var len = text.length;
                var size = '';
                if (len >= 9) size = '23px';
                else if (len >= 7) size = '24px';
                rankEl.style.fontSize = size;
                if (markEl) markEl.style.fontSize = size;
            }
        }
    };

    // Re-scale certificate on window resize
    $(window).on('resize', function() {
        if (window.JPLeaderboardNew) {
            window.JPLeaderboardNew.scaleCertificate();
        }
    });

    // Also scale when clicking on Certificate tab
    $(document).on('click', '[data-toggle=".content_nav2"]', function() {
        setTimeout(function() {
            if (window.JPLeaderboardNew) {
                window.JPLeaderboardNew.scaleCertificate();
                window.JPLeaderboardNew.fitCertName();
            }
        }, 100);
    });

    // Mobile: Tap badges to show tooltip
    let badgeTooltipTimer = null;
    $(document).on('click touchend', '.jp-leaderboard-row .jp-badge[data-tooltip]', function(e) {
        e.preventDefault();
        e.stopPropagation();

        // Remove active from all other badges
        $('.jp-leaderboard-row .jp-badge').removeClass('badge-active');

        // Add active to this badge
        $(this).addClass('badge-active');

        // Auto hide after 3 seconds
        if (badgeTooltipTimer) {
            clearTimeout(badgeTooltipTimer);
        }
        badgeTooltipTimer = setTimeout(function() {
            $('.jp-leaderboard-row .jp-badge').removeClass('badge-active');
        }, 3000);
    });

    // Hide tooltip when clicking outside
    $(document).on('click touchend', function(e) {
        if (!$(e.target).closest('.jp-badge').length) {
            $('.jp-leaderboard-row .jp-badge').removeClass('badge-active');
            if (badgeTooltipTimer) {
                clearTimeout(badgeTooltipTimer);
            }
        }
    });

})(jQuery);
