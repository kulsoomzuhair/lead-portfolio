// Wait for DOM to fully load
document.addEventListener('DOMContentLoaded', () => {
    
    // Elements Selection
    const themeToggleBtn = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const menuIcon = document.getElementById('menuIcon');
    const navbar = document.getElementById('navbar');
    const header = document.querySelector('.main-header');
    
    // Video Modal Elements
    const videoModal = document.getElementById('videoModal');
    const modalVideoPlayer = document.getElementById('modalVideoPlayer');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    
    // Form & Toast Elements
    const contactForm = document.getElementById('contactForm');
    const toastSuccess = document.getElementById('toastSuccess');

    /* -----------------------------------------
       1. Theme Management (Dark/Light Mode)
       ----------------------------------------- */
    const currentTheme = localStorage.getItem('theme') || 'light';
    
    // Apply initial theme
    if (currentTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeIcon.className = 'bi bi-sun-fill';
    } else {
        document.documentElement.removeAttribute('data-theme');
        themeIcon.className = 'bi bi-moon-stars-fill';
    }

    // Toggle theme on click
    themeToggleBtn.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        
        if (isDark) {
            document.documentElement.removeAttribute('data-theme');
            themeIcon.className = 'bi bi-moon-stars-fill';
            localStorage.setItem('theme', 'light');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            themeIcon.className = 'bi bi-sun-fill';
            localStorage.setItem('theme', 'dark');
        }
    });

    /* -----------------------------------------
       2. Mobile Navigation Menu
       ----------------------------------------- */
    mobileMenuBtn.addEventListener('click', () => {
        navbar.classList.toggle('active');
        const isOpen = navbar.classList.contains('active');
        menuIcon.className = isOpen ? 'bi bi-x-lg' : 'bi bi-list';
    });

    // Close menu when clicking on any nav link
    const navLinks = document.querySelectorAll('.nav-link, .nav-cta');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navbar.classList.remove('active');
            menuIcon.className = 'bi bi-list';
        });
    });

    /* -----------------------------------------
       3. Header Scroll Effect
       ----------------------------------------- */
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.style.padding = '8px 0';
            header.style.boxShadow = 'var(--shadow)';
        } else {
            header.style.padding = '16px 0';
            header.style.boxShadow = 'none';
        }
    });

    /* -----------------------------------------
       4. Video Modal Handler
       ----------------------------------------- */
    window.openVideoModal = function(videoUrl) {
        console.log(`[VIDEO PLAY] Target source: ${videoUrl}`);
        modalVideoPlayer.src = videoUrl;
        videoModal.classList.add('active');
        modalVideoPlayer.load();
        modalVideoPlayer.play().catch(err => {
            console.warn("Autoplay failed or browser blocks instant playback:", err);
        });
    };

    function closeModal() {
        videoModal.classList.remove('active');
        modalVideoPlayer.pause();
        modalVideoPlayer.src = '';
    }

    modalCloseBtn.addEventListener('click', closeModal);
    videoModal.addEventListener('click', (e) => {
        if (e.target === videoModal) {
            closeModal();
        }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && videoModal.classList.contains('active')) {
            closeModal();
        }
    });

    /* -----------------------------------------
       5. Contact Form Submission (Simulated)
       ----------------------------------------- */
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const projectType = document.getElementById('projectType').value;
            const message = document.getElementById('message').value;

            console.log(`[FORM SUBMIT] Name: ${name}, Email: ${email}, Type: ${projectType}, Message: ${message}`);
            
            // Show Success Toast
            toastSuccess.classList.add('active');
            
            // Reset form fields
            contactForm.reset();
            
            // Hide toast after 4 seconds
            setTimeout(() => {
                toastSuccess.classList.remove('active');
            }, 4000);
        });
    }
});
