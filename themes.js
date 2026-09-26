/* Presentation preferences only. No API calls or media/session state lives here. */
(() => {
    'use strict';
    const presets = [
        { id:'0', slug:'current', name:'Graffiti Gallery', category:'original', description:'Bức tường trưng bày flagship với mural đa sắc và khung ảnh nổi.', defaultMode:'dark', light:['#fff0dd','#f4d8bf','#fff8eb','#d89e80','#c6325b','#087f88','#241c2b','#6e5360'], dark:['#111019','#1c1724','#251d2d','#573447','#ff526f','#30d6ca','#fff0df','#cfafbd'] },
        { id:'1', slug:'light-minimal', name:'Light Minimal', category:'minimal', description:'Lưới cân đối, đường kẻ mảnh và điểm xanh trên nền trắng.', defaultMode:'light', light:['#ffffff','#f4f7fc','#ffffff','#dbe2ed','#205fbb','#3a78cf','#141b26','#526074'], dark:['#17212f','#1d2b3d','#1b293a','#41516a','#94bbff','#88c8e5','#f2f6fe','#b6c4d8'] },
        { id:'2', slug:'dark-minimal', name:'Dark Minimal', category:'minimal', description:'Thẻ nhỏ gọn, xám than và ánh tím xanh dịu.', defaultMode:'dark', light:['#f5f4fa','#ebe9f4','#ffffff','#d6d2e7','#6043ba','#4865bf','#242034','#665e79'], dark:['#17181d','#202128','#22232b','#3f414e','#b7a4ff','#84a6ff','#f2f0f9','#b6b4c7'] },
        { id:'3', slug:'pinterest', name:'Pinterest', category:'creative', description:'Masonry theo tỷ lệ ảnh gốc, khoảng thoáng và thao tác gọn.', defaultMode:'light', light:['#fffdfa','#f4f0eb','#ffffff','#ded8d0','#ac392f','#be6657','#252222','#6b605b'], dark:['#211d1e','#302729','#2c2426','#59464a','#ffa393','#dfb5a2','#faf2ef','#cdbbb6'] },
        { id:'4', slug:'studio', name:'Creative Studio', category:'creative', description:'Tiêu đề biên tập, khối bất đối xứng, cam đất và hình vẽ tay.', defaultMode:'light', light:['#f8efe0','#efdfc6','#fff9ee','#cdbda6','#a8462b','#be7727','#332c25','#75634f'], dark:['#29201c','#382a24','#352923','#6f5545','#f5a47d','#e8c47e','#fff2dc','#d4bda5'] },
        { id:'5', slug:'glass', name:'Glassmorphism', category:'creative', description:'Panel kính trên các lớp màu tím, xanh và hồng nhẹ.', defaultMode:'light', light:['#e7eafa','#e9ebf9','#f9faff','#bac5e1','#5753a6','#92548d','#252947','#545e80'], dark:['#141b33','#232b49','#252e49','#53617f','#b9bcff','#f0b4e4','#f5f4ff','#c3c9e0'] },
        { id:'6', slug:'dashboard', name:'Professional Dashboard', category:'minimal', description:'Thanh bên, khu tải riêng và bộ lọc rõ ràng; xanh navy, teal.', defaultMode:'light', light:['#f0f4f7','#e7eef3','#ffffff','#d3dee6','#116b65','#337e98','#172c42','#516577'], dark:['#101e2b','#1a2c3c','#1c3040','#3b5568','#80d4c4','#94c9ef','#f1f7fa','#b3c8d6'] },
        { id:'7', slug:'japanese', name:'Japanese Minimal', category:'minimal', description:'Giấy ngà, nét mực, hoa cành và điểm son trong khoảng lặng.', defaultMode:'light', light:['#f9f7ef','#eeece3','#fffef8','#d6d4c8','#a63b30','#66734c','#272c28','#646b60'], dark:['#232823','#30362e','#2c322b','#535f4e','#edaa9d','#b8c592','#f5f2df','#c0c8b6'] },
        { id:'8', slug:'neon', name:'Neon Cyber', category:'special', description:'Lưới kỹ thuật, góc vuông và đường sáng cyan, tím, hồng.', defaultMode:'dark', light:['#eff5fa','#e0eef3','#faffff','#9bbecb','#125b71','#713eb0','#102d3f','#476477'], dark:['#090e18','#101c2b','#111d2c','#30475c','#70eee3','#df9cff','#effdff','#a6becd'] },
        { id:'9', slug:'photobooth', name:'Classic Photobooth', category:'memories', description:'Ảnh thật thành dải 3–4 khung, giấy in và số khung cổ điển.', defaultMode:'light', light:['#e8e6e0','#d9d6ce','#f7f5ef','#b6b0a6','#853c4a','#776b65','#242320','#655e57'], dark:['#262321','#322e2b','#36322e','#686158','#eba6b2','#c3b5a0','#faf3e7','#d1c5b6'] },
        { id:'10', slug:'polaroid', name:'Polaroid', category:'memories', description:'Viền ảnh trắng dày, chú thích, băng giấy và ngôi sao nét bút.', defaultMode:'light', light:['#ede7db','#e0d6c3','#fffefa','#cdc2b0','#486c84','#95694c','#34332d','#6c6559'], dark:['#292820','#363329','#37362f','#6b6657','#acd1e4','#e5ba97','#fff8e8','#d2c8b4'] },
        { id:'11', slug:'scrapbook', name:'Scrapbook', category:'memories', description:'Album giấy kraft, nhãn màu, washi và ảnh xếp nhiều lớp.', defaultMode:'light', light:['#ece3ca','#e0d1b1','#fff5e3','#bfb08b','#596544','#9c543f','#393d2d','#64674e'], dark:['#2c2c20','#3a3a29','#393b2b','#70704e','#d2d5a0','#e5ad85','#fff5db','#d4cead'] },
        { id:'12', slug:'film-lab', name:'90s Film Lab', category:'memories', description:'Contact sheet, mép film, số khung và dấu phòng in.', defaultMode:'light', light:['#ddd0ad','#cbbf9b','#f4e9cd','#ab9874','#824330','#546547','#322c21','#5e523f'], dark:['#29271e','#373323','#3b3427','#786b4e','#e6aa7b','#c3c891','#fff1ca','#d6c59c'] },
        { id:'13', slug:'instant', name:'Modern Instant Camera', category:'memories', description:'Khung ảnh gọn cùng pastel mint, hồng, vàng bơ và tím.', defaultMode:'light', light:['#f6f5ef','#e5eee9','#ffffff','#cbded4','#47696d','#906087','#283e42','#5f7170'], dark:['#222d30','#2e3d3f','#304145','#586e70','#b5ddce','#e1b6d1','#f4faf1','#bfd6cf'] },
        { id:'14', slug:'darkroom', name:'Darkroom', category:'special', description:'Ảnh treo bằng kẹp, khay tráng và ánh đèn đỏ trong nền navy.', defaultMode:'dark', light:['#eee6e3','#e5d5d1','#fff8f1','#d0b7b0','#933e38','#586879','#292b30','#6d5e5e'], dark:['#0b121b','#17232e','#19242e','#48515e','#f5a39a','#9fb8cb','#f4f0e8','#b8c3cc'] },
        { id:'15', slug:'digital', name:'Digital Camera Album', category:'special', description:'Khung ngắm LCD, nút playback và thông tin ngày, tệp.', defaultMode:'dark', light:['#e7edea','#d5e1db','#f8fcf9','#9fb4a9','#2d6554','#496c9c','#183b30','#486358'], dark:['#151d20','#203035','#213238','#526c70','#abe2be','#9ecde9','#effff1','#b6d4ca'] },
        { id:'16', slug:'playful', name:'Playful Photobooth', category:'special', description:'Khung vui, sticker hoa, sao, trái tim và lời nhắn đầy màu sắc.', defaultMode:'light', light:['#fff5e9','#fbe1ea','#ffffff','#e2b9cb','#9e3166','#4662ad','#3c2647','#756077'], dark:['#282033','#3c2c48','#3a2b46','#705c81','#ffb2d4','#b9c9ff','#fff5fa','#dcc0dc'] },
        { id:'17', slug:'love', name:'Dreamy Love', category:'special', description:'Thế giới tình yêu tương lai với ánh ngọc trai và trái tim pha lê.', defaultMode:'dark', light:['#fff1f6','#f3dfed','#fffaff','#dfc5dc','#a52d75','#8d528e','#36233c','#705d76'], dark:['#170d24','#291332','#382044','#6b426d','#ff5caf','#ffb1dc','#fff4fb','#ddc4df'] }
    ];
    let id = '0';
    let modes = {};
    let legacyMode;
    try {
        const saved = localStorage.getItem('media-gallery-gallery-theme');
        if (presets.some(p => p.id === saved)) id = saved;
        const storedModes = JSON.parse(localStorage.getItem('media-gallery-theme-modes') || '{}');
        if (storedModes && typeof storedModes === 'object' && !Array.isArray(storedModes)) modes = storedModes;
        legacyMode = localStorage.getItem('media-gallery-theme');
    } catch (_) { /* Private browsing/storage restrictions must not prevent rendering. */ }
    const validMode = value => value === 'light' || value === 'dark';
    let mode = validMode(modes[id]) ? modes[id] : validMode(legacyMode) ? legacyMode : presets[Number(id)].defaultMode;
    const variables = ['--bg-primary','--bg-secondary','--card-bg','--card-border','--accent-primary','--accent-secondary','--text-primary','--text-muted'];
    function paint(nextId = id, nextMode = mode) {
        const preset = presets.find(p => p.id === nextId) || presets[0];
        id = preset.id;
        mode = validMode(nextMode) ? nextMode : preset.defaultMode;
        modes[id] = mode;
        document.documentElement.dataset.galleryTheme = id;
        // Current keeps its original native control rendering as well as its CSS.
        document.documentElement.style.colorScheme = id === '0' ? '' : mode;
        if (!document.body) return;
        const body = document.body;
        presets.forEach(p => body.classList.remove(`theme-${p.slug}`));
        body.classList.add(`theme-${preset.slug}`);
        body.dataset.galleryTheme = id;
        body.dataset.theme = mode;
        variables.forEach((key, i) => body.style.setProperty(key, preset[mode][i]));
        body.style.setProperty('--danger', mode === 'dark' ? '#df786b' : '#a94236');
        body.style.setProperty('--success', mode === 'dark' ? '#a6c19f' : '#55765e');
        body.style.setProperty('--warning', mode === 'dark' ? '#ddb36f' : '#a77435');
        body.style.setProperty('--on-accent', mode === 'dark' ? '#15212b' : '#ffffff');
    }
    function save() {
        try {
            localStorage.setItem('media-gallery-gallery-theme', id);
            localStorage.setItem('media-gallery-theme', mode);
            localStorage.setItem('media-gallery-theme-modes', JSON.stringify(modes));
        } catch (_) { /* The applied theme still works until the page is closed. */ }
    }
    window.GalleryThemes = {
        presets, paint, save,
        get id() { return id; }, get mode() { return mode; },
        modeFor(nextId) { return validMode(modes[nextId]) ? modes[nextId] : (presets.find(p => p.id === nextId) || presets[0]).defaultMode; }
    };
    paint();
})();
