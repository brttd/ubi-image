const packager = require('electron-packager')

packager({
    dir: 'app',
    asar: true,
    icon: 'app/icon.ico',
    name: 'Ubi Image'
})
