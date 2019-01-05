const { app, BrowserWindow } = require('electron')

const path = require('path')
const url = require('url')

const appPath = app.getAppPath()

app.on('ready', () => {
    let mainWindow = new BrowserWindow({
        frame: false,
        transparent: true,
        show: false,

        icon: path.join(appPath, 'icon.ico'),

        minWidth: 500,
        minHeight: 300
    })

    mainWindow.on('ready-to-show', () => {
        mainWindow.show()
    })

    mainWindow.loadURL(
        url.format({
            protocol: 'file:',
            slashes: true,
            pathname: path.join(appPath, 'library.html')
        })
    )

    mainWindow.webContents.on('will-navigate', event => {
        event.preventDefault()
    })
})
