document.addEventListener('DOMContentLoaded', () => {
    const navbarToggle = document.getElementById('navbar-toggle');
    const navbarMenu = document.querySelector('.navbar-menu');

    if (!navbarToggle || !navbarMenu) {
        return;
    }

    navbarToggle.addEventListener('click', () => {
        navbarMenu.classList.toggle('active');
        navbarToggle.classList.toggle('active');
    });

    document.addEventListener('click', (event) => {
        if (!navbarToggle.contains(event.target) && !navbarMenu.contains(event.target)) {
            navbarMenu.classList.remove('active');
            navbarToggle.classList.remove('active');
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            navbarMenu.classList.remove('active');
            navbarToggle.classList.remove('active');
        }
    });
});
