# 图片资源说明

## 文件夹结构

```
assets/images/
├── apps/          # 应用图标 (80x80px)
│   ├── einkbro.png
│   ├── koreader.png
│   ├── kindle.png
│   ├── libby.png
│   ├── wechat-reading.png
│   └── eudic.png
├── devices/       # 设备照片 (200x200px)
│   ├── p6.jpg
│   ├── go-10-3.jpg
│   ├── nomad.jpg
│   ├── manta.jpg
│   ├── obook-5.jpg
│   └── paperlike-13k.jpg
├── icons/         # 通用图标 (24x24px, 32x32px)
│   ├── search.svg
│   ├── home.svg
│   └── arrow.svg
└── logos/         # 网站Logo (120x40px)
    ├── apov-logo.png
    └── apov-logo-white.png
```

## 图片规格建议

### 应用图标 (apps/)
- 尺寸：80x80px
- 格式：PNG (支持透明背景)
- 风格：简洁、易识别
- 命名：应用名称小写，用连字符分隔

### 设备照片 (devices/)
- 尺寸：200x200px
- 格式：JPG (照片) 或 PNG (产品图)
- 风格：产品正面图，背景简洁
- 命名：设备型号小写，用连字符分隔
- 当前设备：
  - `p6.jpg` - 文石 P6（小白马）
  - `go-10-3.jpg` - 文石 Go 10.3
  - `nomad.jpg` - 超级笔记 Nomad
  - `manta.jpg` - 超级笔记 Manta
  - `obook-5.jpg` - 国文 OBOOK 5
  - `paperlike-13k.jpg` - 大上 Paperlike 13K

### 通用图标 (icons/)
- 尺寸：24x24px 或 32x32px
- 格式：SVG (矢量) 或 PNG
- 风格：单色，简洁
- 命名：功能描述，用连字符分隔

### 网站Logo (logos/)
- 尺寸：120x40px (主logo)
- 格式：PNG (支持透明背景)
- 风格：品牌标识
- 命名：品牌名称 + 用途

## 使用示例

在HTML中使用图片：

```html
<!-- 应用图标 -->
<img src="assets/images/apps/einkbro.png" alt="EinkBro" class="app-icon">

<!-- 设备照片 -->
<img src="assets/images/devices/p6.jpg" alt="文石 P6（小白马）" class="device-photo">

<!-- 通用图标 -->
<img src="assets/images/icons/search.svg" alt="搜索" class="search-icon">

<!-- 网站Logo -->
<img src="assets/images/logos/apov-logo.png" alt="APOV" class="logo">
```

## 注意事项

1. 所有图片都应该有适当的 `alt` 属性
2. 使用相对路径引用图片
3. 图片文件大小应该优化，建议单张图片不超过100KB
4. 支持响应式图片时，可以提供多个尺寸版本 