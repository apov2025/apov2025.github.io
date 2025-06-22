// 动态加载二维码底部组件（用于子目录页面）
function loadQRFooter() {
    const qrFooter = document.createElement('div');
    qrFooter.className = 'qr-section';
    
    const img = document.createElement('img');
    img.src = '../assets/images/qrcode/qrcode-apov_wechat-account.JPG';
    img.alt = 'apov 公众号二维码';
    
    qrFooter.appendChild(img);
    document.body.appendChild(qrFooter);
}

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    loadQRFooter();
}); 