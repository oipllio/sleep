# 久美子的星河圣诞树

这是一个纯静态的 3D 星河圣诞树页面。照片挂在树外缓慢环绕，树冠由礼物、金球、糖杖、流动灯带和雪光组成，适合直接通过 GitHub Pages 访问。

在线页面：https://oipllio.github.io/sleep/kumiko-christmas/

## 当前内容

- `kumiko-christmas/`：圣诞树页面、照片清单、本地 Three.js 依赖和图片资源。
- `index.html`：跳转到圣诞树页面的仓库根页。
- `.github/scripts/check_static_site.py`：基础静态检查脚本。

## 本地预览

```bash
python -m http.server 8000
```

然后打开 `http://localhost:8000/kumiko-christmas/`。

## 检查

```bash
python .github/scripts/check_static_site.py
```

检查脚本会验证 HTML 基本结构、UTF-8、标题、视口设置，以及 `kumiko-christmas/photos.json` 中的本地图片路径。
