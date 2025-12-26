const btnFullscreen = document.getElementById('toggleFullscreen');

btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((e) => {
            console.log(`Error attempting to enable fullscreen: ${e.message}`);
        });
        btnFullscreen.innerHTML = '<i class="fas fa-compress"></i> Exit Fullscreen';
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
            btnFullscreen.innerHTML = '<i class="fas fa-expand"></i> Fullscreen';
        }
    }
});