/**
 * ════════════════════════════════════════════════════════════════════
 *  CẤU HÌNH BADGES (HUY HIỆU) — THÊM/SỬA Ở ĐÂY
 * ════════════════════════════════════════════════════════════════════
 *  Tìm khối `const BadgeConfig = { ... }` bên dưới. Mỗi huy hiệu 1 khối:
 *
 *      'MÃ': {                          ← MÃ = đúng chữ nhập ở cột Danh hiệu (sheet)
 *          class: 'badge-orange',       ← màu: yellow/green/orange/blue/cyan/pink/purple/red/gray
 *          icon: BadgeIcons.Flame,      ← icon: Star/Medal/Trophy/Flame/Crown/Zap/Target/Award/Shield/Gem/Heart/Sparkles/Rocket
 *          label: 'HAT',                ← chữ NGẮN hiện trên huy hiệu
 *          fullLabel: 'HAT-TRICK'       ← GIẢI THÍCH đầy đủ (hiện khi rê chuột + trong popup VĐV)
 *      },
 *
 *  • Thêm badge mới: copy 1 khối, đổi 'MÃ' + 4 dòng. Lưu file là xong.
 *  • Badge dạng KING2025 / QUEEN2024 / PT2022 tự động nhận theo năm (không cần khai báo).
 *  • Nếu data có mã CHƯA khai báo → hiện ô vàng ghi mã đó để biết mà thêm.
 * ════════════════════════════════════════════════════════════════════
 */

(function(window) {
    'use strict';

    // SVG Icons cho badges
    const BadgeIcons = {
        Crown: '<svg class="w-2.5 h-2.5 md:w-3 md:h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>',
        Medal: '<svg class="w-2.5 h-2.5 md:w-3 md:h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>',
        Star: '<svg class="w-2.5 h-2.5 md:w-3 md:h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
        Zap: '<svg class="w-2.5 h-2.5 md:w-3 md:h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
        Trophy: '<svg class="w-2.5 h-2.5 md:w-3 md:h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
        Target: '<svg class="w-2.5 h-2.5 md:w-3 md:h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
        Award: '<svg class="w-2.5 h-2.5 md:w-3 md:h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>',
        Flame: '<svg class="w-2.5 h-2.5 md:w-3 md:h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
        Rocket: '<svg class="w-2.5 h-2.5 md:w-3 md:h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>',
        Shield: '<svg class="w-2.5 h-2.5 md:w-3 md:h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
        Gem: '<svg class="w-2.5 h-2.5 md:w-3 md:h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="6 3 18 3 22 9 12 21 2 9 6 3"/><polyline points="8 3 12 9 16 3"/><polyline points="2 9 12 9 22 9"/></svg>',
        Heart: '<svg class="w-2.5 h-2.5 md:w-3 md:h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
        Sparkles: '<svg class="w-2.5 h-2.5 md:w-3 md:h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>',
        // Unicode crown symbols for KING/QUEEN badges - responsive sizing
        KingCrown: '<span class="jp-crown-icon">♔</span>',
        QueenCrown: '<span class="jp-crown-icon">♕</span>'
    };

    // Cấu hình tất cả badges
    // Để thêm badge mới, chỉ cần thêm vào object này
    const BadgeConfig = {
        // ============================================
        // BADGES CHÍNH THỨC
        // ============================================
        'VIP': {
            class: 'badge-yellow',
            icon: BadgeIcons.Star,
            label: 'VIP',
            fullLabel: 'VIP MEMBERSHIP'
        },
        'KLQG': {
            class: 'badge-red',
            icon: BadgeIcons.Crown,
            label: 'KLQG',
            fullLabel: 'KỶ LỤC QUỐC GIA'
        },
        'TOP1PT': {
            class: 'badge-blue',
            icon: BadgeIcons.Medal,
            label: 'TOP1',
            fullLabel: 'TOP 1 PHONG TRÀO'
        },
        'CKLQG': {
            class: 'badge-gray',
            icon: BadgeIcons.Trophy,
            label: 'CKLQG',
            fullLabel: 'CỰU KỶ LỤC QUỐC GIA'
        },
        'HATTRICK': {
            class: 'badge-orange',
            icon: BadgeIcons.Flame,
            label: 'HAT',
            fullLabel: 'HATTRICK'
        },
        'POKER': {
            class: 'badge-green',
            icon: BadgeIcons.Zap,
            label: 'POKER',
            fullLabel: 'POKER'
        },
        'REPOKER': {
            class: 'badge-pink',
            icon: BadgeIcons.Sparkles,
            label: 'REPO',
            fullLabel: 'REPOKER'
        },
        'ELITE': {
            class: 'badge-purple',
            icon: BadgeIcons.Zap,
            label: 'ELITE',
            fullLabel: 'ELITE'
        },

        // ============================================
        // BADGES THÀNH TÍCH
        // ============================================
        'CTOP1PT': {
            class: 'badge-gray',
            icon: BadgeIcons.Award,
            label: 'CTOP1',
            fullLabel: 'CỰU TOP 1 PT'
        },
        'HT-S3': {
            class: 'badge-cyan',
            icon: BadgeIcons.Medal,
            label: 'HT-S3',
            fullLabel: 'HATTRICK - SUB3'
        },
        'HT-S240': {
            class: 'badge-orange',
            icon: BadgeIcons.Medal,
            label: 'HT240',
            fullLabel: 'HATTRICK - SUB240'
        },
        'PKR-S3': {
            class: 'badge-cyan',
            icon: BadgeIcons.Star,
            label: 'PKR-S3',
            fullLabel: 'POKER - SUB3'
        },
        'KM2022': {
            class: 'badge-purple',
            icon: BadgeIcons.Crown,
            label: 'KM22',
            fullLabel: 'KING MARATHON 2022'
        },
        'D-HT': {
            class: 'badge-red',
            icon: BadgeIcons.Flame,
            label: 'D-HT',
            fullLabel: 'DOUBLE - HATTRICK'
        },
        'SNOW': {
            class: 'badge-cyan',
            icon: BadgeIcons.Gem,
            label: 'SNOW',
            fullLabel: 'SNOWMAN'
        },
        'HAUL': {
            class: 'badge-orange',
            icon: BadgeIcons.Target,
            label: 'HAUL',
            fullLabel: 'HAUL-TRICK'
        },
        'GBA': {
            class: 'badge-yellow',
            icon: BadgeIcons.Trophy,
            label: 'GBA',
            fullLabel: 'GOLDEN BOOT AWARD'
        }
    };

    // Merge badges quản lý từ UI Admin (window.JPBadgeConfigDB) — đè/thêm lên default.
    // DB lưu {code: {color, icon(tên), label, fullLabel}} → resolve icon tên → SVG.
    if (window.JPBadgeConfigDB && typeof window.JPBadgeConfigDB === 'object') {
        Object.keys(window.JPBadgeConfigDB).forEach(function (code) {
            var d = window.JPBadgeConfigDB[code] || {};
            BadgeConfig[code] = {
                class: 'badge-' + (d.color || 'gray'),
                icon: BadgeIcons[d.icon] || BadgeIcons.Star,
                label: d.label || code,
                fullLabel: d.fullLabel || code
            };
        });
    }

    // Export ra window để các file khác sử dụng
    window.JPBadgeConfig = BadgeConfig;
    window.JPBadgeIcons = BadgeIcons;

})(window);
