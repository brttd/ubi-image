const { app, BrowserWindow, ipcMain } = require('electron')

const fs = require('fs')
const path = require('path')
const url = require('url')

const async = require('async')
const imageSize = require('image-size')

const appPath = app.getAppPath()

const validImageExtensions = [
    '.bmp',
    '.gif',
    '.ico',
    '.jpeg',
    '.jpg',
    '.png',
    '.webp',
    '.svg'
]

const folders = []

const maxChangeCount = 100

let searchWindow = null

//folders
{
    function isValidImage(filePath) {
        return validImageExtensions.includes(
            path.extname(filePath).toLowerCase()
        )
    }

    function sendFolderFileAddChange(folder) {
        let addList = folder.tempAddFiles.splice(0, maxChangeCount)

        searchWindow.webContents.send(
            'add-to-folder',
            folder.path,
            'add',
            addList
        )
    }

    function updateFolder(folder, subdir = '', callback) {
        fs.readdir(path.join(folder.path, subdir), (error, content) => {
            if (error) {
                console.error(error)

                return false
            }

            async.each(
                content,
                (item, callback) => {
                    let itemPath = path.join(folder.path, subdir, item)

                    fs.stat(itemPath, (error, stats) => {
                        if (stats.isFile()) {
                            if (isValidImage(itemPath)) {
                                let size = imageSize(itemPath)

                                let file = {
                                    name: path.basename(
                                        item,
                                        path.extname(item)
                                    ),
                                    nameLower:
                                        path
                                            .basename(item, path.extname(item))
                                            .toLowerCase() +
                                        ' ' +
                                        path.extname(item).toLowerCase(),

                                    path: itemPath,

                                    folders: subdir.split(path.sep),
                                    foldersLower: subdir
                                        .split(path.sep)
                                        .map(dirName => dirName.toLowerCase()),

                                    width: size.width || 0,
                                    height: size.height || 0,

                                    extension: path.extname(item).toLowerCase()
                                }

                                folder.files.push(file)

                                folder.tempAddFiles.push(file)
                            }

                            if (folder.tempAddFiles.length >= maxChangeCount) {
                                sendFolderFileAddChange(folder)
                            }

                            callback()
                        } else if (stats.isDirectory()) {
                            updateFolder(
                                folder,
                                path.join(subdir, item),
                                callback
                            )
                        } else {
                            callback()
                        }
                    })
                },
                error => {
                    if (error) {
                        console.error(error)
                        return false
                    }

                    while (folder.tempAddFiles.length > 0) {
                        sendFolderFileAddChange(folder)
                    }
                }
            )
        })
    }
    function removeFolder(folderPath) {
        let index = folders.findIndex(folder => folder.path === folderPath)

        if (index === -1) {
            return false
        }

        searchWindow.webContents.send('remove-folder', folderPath)

        folders.splice(index, 1)
    }

    function addFolder(folderPath, callback) {
        if (!path.isAbsolute(folderPath)) {
            if (typeof callback === 'function') {
                callback(false)
            }

            return false
        }

        let folder = {
            path: folderPath,

            files: [],

            tempAddFiles: [],

            remove: removeFolder.bind(null, folderPath)
        }

        updateFolder(folder)

        folders.push(folder)
    }

    ipcMain.on('add-folder', (event, folderPath) => {
        addFolder(folderPath)
    })
    ipcMain.on('remove-folder', (event, folderPath) => {
        removeFolder(folderPath)
    })
    ipcMain.on('refresh-folder', (event, folderPath) => {
        let index = folders.findIndex(folder => folder.path === folderPath)

        if (index === -1) {
            return false
        }

        folders[index].files = []
        folders[index].tempAddFiles = []

        updateFolder(folders[index])
    })
}

app.on('ready', () => {
    searchWindow = new BrowserWindow({
        frame: false,
        show: false,

        icon: path.join(appPath, 'icon.ico'),

        minWidth: 300,
        minHeight: 200
    })

    searchWindow.on('closed', () => {
        app.quit()
    })

    searchWindow.on('ready-to-show', () => {
        searchWindow.show()
    })

    searchWindow.loadURL(
        url.format({
            protocol: 'file:',
            slashes: true,
            pathname: path.join(appPath, 'library.html')
        })
    )

    searchWindow.webContents.on('will-navigate', event => {
        event.preventDefault()
    })
})
