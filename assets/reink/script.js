document.addEventListener('DOMContentLoaded', function() {
    const imageGallery = document.getElementById('imageGallery');
    const backgroundWallpaper = document.getElementById('backgroundWallpaper');
    const imageUpload = document.getElementById('imageUpload');
    const scrollLeftBtn = document.getElementById('scrollLeft');
    const scrollRightBtn = document.getElementById('scrollRight');
    
    // Dynamic wallpapers array - will be populated from API
    let wallpapers = [];
    
    // Load wallpapers from API
    async function loadWallpapers() {
        try {
            const response = await fetch('api.php');
            const data = await response.json();
            
            if (data.success) {
                wallpapers = data.wallpapers.map(item => item.path);
                initializeGallery();
                // Initialize scroll buttons after gallery is populated
                setTimeout(updateScrollButtons, 100);
            } else {
                console.error('Failed to load wallpapers:', data.error);
                // Fallback to manual list if API fails
                wallpapers = [
                    'assets/images/reink/wallpapers/photo-01.jpg',
                    'assets/images/reink/wallpapers/photo-02.jpg',
                    'assets/images/reink/wallpapers/photo-03.jpg',
                    'assets/images/reink/wallpapers/photo-04.jpg',
                    'assets/images/reink/wallpapers/photo-05.jpg'
                ];
                initializeGallery();
                setTimeout(updateScrollButtons, 100);
            }
        } catch (error) {
            console.error('Error loading wallpapers:', error);
            // Fallback to manual list if API is not available
            wallpapers = [
                'assets/images/reink/wallpapers/photo-01.jpg',
                'assets/images/reink/wallpapers/photo-02.jpg',
                'assets/images/reink/wallpapers/photo-03.jpg',
                'assets/images/reink/wallpapers/photo-04.jpg',
                'assets/images/reink/wallpapers/photo-05.jpg'
            ];
            initializeGallery();
            setTimeout(updateScrollButtons, 100);
        }
    }

    // Initialize gallery
    function initializeGallery() {
        // Clear existing gallery items
        imageGallery.innerHTML = '';
        
        wallpapers.forEach((wallpaper, index) => {
            const galleryItem = document.createElement('div');
            galleryItem.className = 'gallery-item';
            galleryItem.dataset.image = wallpaper;
            
            const img = document.createElement('img');
            img.src = wallpaper;
            img.alt = `Wallpaper ${index + 1}`;
            img.loading = 'lazy';
            
            // Handle image load errors
            img.onerror = function() {
                console.warn(`Failed to load image: ${wallpaper}`);
                galleryItem.style.display = 'none';
            };
            
            galleryItem.appendChild(img);
            galleryItem.addEventListener('click', () => selectImage(wallpaper, galleryItem));
            
            imageGallery.appendChild(galleryItem);
        });
    }
    
    // Select image from gallery
    function selectImage(imageSrc, galleryItem) {
        // Remove selected class from all items
        document.querySelectorAll('.gallery-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        // Add selected class to clicked item
        galleryItem.classList.add('selected');
        
        // Apply image to mockup
        applyImageToMockup(imageSrc);
    }
    
    // Apply image to mockup with proper scaling
    function applyImageToMockup(imageSrc) {
        backgroundWallpaper.src = imageSrc;
        backgroundWallpaper.style.display = 'block';
        
        // Wait for image to load to get proper dimensions
        backgroundWallpaper.onload = function() {
            // The CSS handles the sizing and positioning
            // The image will show through the transparent cutoff area
            console.log('Image applied to mockup:', imageSrc);
        };
    }
    
    // Handle file upload
    imageUpload.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                // Remove selection from gallery items
                document.querySelectorAll('.gallery-item').forEach(item => {
                    item.classList.remove('selected');
                });
                
                // Apply uploaded image
                applyImageToMockup(e.target.result);
            };
            
            reader.readAsDataURL(file);
        }
    });
    
    // Gallery scroll functionality
    function updateScrollButtons() {
        const isAtStart = imageGallery.scrollLeft <= 0;
        const isAtEnd = imageGallery.scrollLeft >= imageGallery.scrollWidth - imageGallery.clientWidth - 1;
        
        scrollLeftBtn.disabled = isAtStart;
        scrollRightBtn.disabled = isAtEnd;
    }
    
    function scrollGallery(direction) {
        const scrollAmount = 200; // Adjust scroll distance
        const currentScroll = imageGallery.scrollLeft;
        
        if (direction === 'left') {
            imageGallery.scrollTo({
                left: currentScroll - scrollAmount,
                behavior: 'smooth'
            });
        } else {
            imageGallery.scrollTo({
                left: currentScroll + scrollAmount,
                behavior: 'smooth'
            });
        }
        
        // Update button states after scroll animation
        setTimeout(updateScrollButtons, 300);
    }
    
    // Event listeners for scroll buttons
    scrollLeftBtn.addEventListener('click', () => scrollGallery('left'));
    scrollRightBtn.addEventListener('click', () => scrollGallery('right'));
    
    // Update button states on scroll
    imageGallery.addEventListener('scroll', updateScrollButtons);
    
    // Update button states on window resize
    window.addEventListener('resize', updateScrollButtons);
    
    // Initialize the application
    loadWallpapers();
    
    // Optional: Add a "clear" button functionality
    function clearCustomImage() {
        backgroundWallpaper.style.display = 'none';
        backgroundWallpaper.src = '';
        document.querySelectorAll('.gallery-item').forEach(item => {
            item.classList.remove('selected');
        });
    }
    
    // You can expose this function globally if you want to add a clear button
    window.clearCustomImage = clearCustomImage;
    
    // Handle responsive adjustments
    function handleResize() {
        // The CSS handles responsive design, but you can add
        // additional JavaScript adjustments here if needed
    }
    
    window.addEventListener('resize', handleResize);
    
    // Optional: Add keyboard navigation
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            clearCustomImage();
        }
    });
});