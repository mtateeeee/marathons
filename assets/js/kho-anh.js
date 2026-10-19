/**
 * Kho ảnh VĐV — bản JavaScript của `kho-anh.php`.
 *
 * Ba màn hình BXH (BXH mới, BXH cũ, danh sách CLB) nằm ở ba tệp JS khác nhau và
 * trước đây mỗi tệp tự dựng URL ảnh theo kiểu riêng — một tệp còn cắm cứng địa
 * chỉ kho. Dời kho là phải nhớ đủ ba chỗ. Nay cả ba gọi vào đây.
 *
 * Địa chỉ kho do PHP đẩy sang qua `JPKhoAnhCauHinh` (xem `jp_kho_anh_nhung_js`).
 * Luật bỏ dấu / viết hoa / mã hoá phải khớp `jp_kho_anh_chuan_hoa_ma` bên PHP —
 * lệch là hai bên ra hai URL khác nhau cho cùng một người.
 *
 * Ảnh thay thế thì CHỈ có ở đây, không có bản PHP: mọi chỗ hiển thị ảnh VĐV đều
 * dựng ở trình duyệt.
 */
(function (window) {
    'use strict';

    var K = window.JPKhoAnh || {};

    // Bản dự phòng nếu wp_localize_script chưa chạy: kho mới. Không để rỗng —
    // rỗng thì URL thành "/NGUYEN VAN A.jpg", trỏ về chính bestmarathon.vn và
    // 404 im lặng.
    K.url = (window.JPKhoAnhCauHinh && window.JPKhoAnhCauHinh.url) || 'https://anh.bestmarathon.vn';

    /** Chuẩn hoá mã VĐV về đúng quy ước tên tệp trong kho: bỏ dấu, viết hoa. */
    K.chuanHoaMa = function (ma) {
        if (!ma) return '';
        return String(ma).trim()
            .replace(/Đ/g, 'D')
            .replace(/đ/g, 'd')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase();
    };

    /** URL ảnh của một VĐV. Trả '' nếu không có mã. */
    K.vdv = function (ma) {
        var m = K.chuanHoaMa(ma);
        return m ? K.url + '/' + encodeURIComponent(m) + '.jpg' : '';
    };

    /**
     * Ảnh thay thế khi chưa có ảnh VĐV: hình vuông xám kèm chữ cái đầu.
     *
     * Thay cho `via.placeholder.com` — tên miền đó đã chết, nên mỗi VĐV chưa có
     * ảnh vừa hiện biểu tượng vỡ vừa bắt trình duyệt chờ hết thời gian kết nối.
     */
    K.anhThayThe = function (ten, co) {
        var chu = (ten && String(ten).trim().charAt(0).toUpperCase()) || '?';
        var s = Math.max(16, parseInt(co, 10) || 56);
        var f = Math.round(s * 0.42 * 10) / 10;

        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + s + '" height="' + s + '" viewBox="0 0 ' + s + ' ' + s + '">'
            + '<rect width="' + s + '" height="' + s + '" fill="#e2e8f0"/>'
            + '<text x="50%" y="50%" dy="0.35em" text-anchor="middle" fill="#64748b"'
            + ' font-family="Inter,Arial,sans-serif" font-size="' + f + '" font-weight="600">'
            + chu.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
            + '</text></svg>';

        // encodeURIComponent thay cho btoa: btoa ném lỗi với chữ ngoài Latin-1,
        // mà chữ cái đầu của tên VĐV thì có thể là chữ có dấu.
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    };

    /**
     * Gắn ảnh thay thế cho một thẻ <img> khi ảnh hỏng. Dùng ở thuộc tính onerror.
     *
     * Bỏ trống `ten` thì lấy từ thuộc tính `alt` của chính thẻ ảnh. Cố ý: chỗ gọi
     * hay nằm trong chuỗi HTML dựng bằng tay, nhét tên người vào giữa một thuộc
     * tính onerror là mở đường cho tên có dấu nháy làm vỡ cả thẻ.
     *
     * Tự gỡ chính nó để ảnh thay thế lỗi (không thể) cũng không thành vòng lặp.
     */
    K.hong = function (img, ten, co) {
        img.onerror = null;
        img.src = K.anhThayThe(ten || img.getAttribute('alt') || '', co || img.width || 56);
    };

    window.JPKhoAnh = K;
})(window);
