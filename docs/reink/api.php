<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

// Set the wallpapers directory
$wallpapersDir = __DIR__ . '/wallpapers/';

// Common image extensions
$allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];

// Function to get all image files from wallpapers directory
function getWallpapers($directory, $allowedExtensions) {
    $wallpapers = [];
    
    if (!is_dir($directory)) {
        return $wallpapers;
    }
    
    $files = scandir($directory);
    
    foreach ($files as $file) {
        if ($file === '.' || $file === '..') {
            continue;
        }
        
        $filePath = $directory . $file;
        
        // Check if it's a file and has an allowed extension
        if (is_file($filePath)) {
            $extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));
            
            if (in_array($extension, $allowedExtensions)) {
                $wallpapers[] = [
                    'filename' => $file,
                    'path' => 'wallpapers/' . $file,
                    'size' => filesize($filePath),
                    'modified' => filemtime($filePath)
                ];
            }
        }
    }
    
    // Sort by filename for consistent ordering
    usort($wallpapers, function($a, $b) {
        return strcmp($a['filename'], $b['filename']);
    });
    
    return $wallpapers;
}

try {
    $wallpapers = getWallpapers($wallpapersDir, $allowedExtensions);
    
    echo json_encode([
        'success' => true,
        'wallpapers' => $wallpapers,
        'count' => count($wallpapers)
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to load wallpapers: ' . $e->getMessage()
    ]);
}
?>