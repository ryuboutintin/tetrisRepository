document.addEventListener('DOMContentLoaded', () => {
    // Dark Mode Toggle
    const darkModeToggle = document.getElementById('darkModeToggle');
    const toggleIcon = darkModeToggle.querySelector('.toggle-icon');
    const savedTheme = localStorage.getItem('theme');

    // Load saved theme
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        toggleIcon.textContent = '☀️';
    }

    // Toggle dark mode
    darkModeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');

        toggleIcon.textContent = isDarkMode ? '☀️' : '🌙';
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    });

    // Smooth scroll for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Alert for example email
    document.querySelectorAll('a[href*="example.com"]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            alert('실제 사용 시 이메일 주소를 변경해주세요!');
        });
    });
});
