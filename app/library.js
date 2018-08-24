const { remote } = require('electron')
const { dialog, BrowserWindow, app } = remote
const fs = require('fs')
const path = require('path')
const async = require('async')
const imageSize = require('image-size')

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

const folders = [
    /*
        {
            name: '..',
            path: '..',
            watcher: {...},

            updateSearch: (...),

            files: [
                {
                    name: '..',
                    path: '..',

                    folders: ['..', ...],

                    width: .,
                    height: .,

                    extension: '..',
                }
            ]
        }
        */
]

const search = {
    terms: [],

    results: []
}

const userOptions = {
    savedFolders: [],

    _lastSaveTime: 0,
    _minSaveTime: 500,
    save: (force = false) => {
        if (
            force ||
            Date.now() - userOptions._lastSaveTime >= userOptions._minSaveTime
        ) {
            userOptions._lastSaveTime = Date.now()

            fs.writeFile(
                path.join(app.getPath('userData'), 'userOptions.json'),
                JSON.stringify({
                    savedFolders: userOptions.savedFolders
                }),
                'utf8',
                error => {
                    if (error) {
                        console.error("Couldn't save user options", error)
                    } else {
                        userOptions._lastSaveTime = Date.now()
                    }
                }
            )
        } else {
            setTimeout(
                userOptions.save,
                userOptions._minSaveTime -
                    (Date.now() - userOptions._lastSaveTime) +
                    5
            )
        }
    }
}

function isValidImage(filePath) {
    return validImageExtensions.includes(path.extname(filePath).toLowerCase())
}

let thisWindow

let checkSearchDisplay
let removeSearchDisplay

let setSize

//Search UI
{
    const searchInput = document.getElementById('search-box')

    const resultsBox = document.getElementById('results')

    const oldResultNodes = []

    let maxSize = 150

    function getResultNode(file) {
        let elem

        if (oldResultNodes.length > 0) {
            elem = oldResultNodes.pop()
        } else {
            elem = document.createElement('div')
            elem.appendChild(document.createElement('img'))
            elem.appendChild(document.createElement('span'))
        }

        elem.firstChild.src = file.path
        elem.firstChild.title = file.path

        if (file.width / file.height > 1) {
            elem.firstChild.style.width = elem.lastChild.style.width =
                maxSize + 'px'

            elem.firstChild.style.height =
                file.height * (maxSize / file.width) + 'px'
        } else {
            elem.firstChild.style.height = maxSize + 'px'

            elem.firstChild.style.width = elem.lastChild.style.width =
                file.width * (maxSize / file.height) + 'px'
        }

        elem.lastChild.textContent = file.name

        elem.data = file

        return elem
    }

    removeSearchDisplay = function(file) {
        let inde = search.results.indexOf(file)
        if (inde !== -1) {
            search.results.splice(inde, 1)

            oldResultNodes.push(resultsBox.children[inde])

            resultsBox.removeChild(resultsBox.children[inde])
        }
    }

    checkSearchDisplay = function(file) {
        removeSearchDisplay(file)

        let index = -1
        let missed = 0

        for (let i = 0; i < search.terms.length; i++) {
            let tIndex = file.name.indexOf(search.terms[i])
            if (tIndex === -1) {
                missed += search.terms[i].length
            } else {
                index += tIndex + 1
            }
        }

        if (index !== -1) {
            index += missed

            file.searchScore = index

            let resultIndex = search.results.findIndex(
                item => item.searchScore >= index
            )

            let resultElement = getResultNode(file)

            if (resultIndex === -1) {
                search.results.push(file)

                resultsBox.appendChild(resultElement)
            } else {
                search.results.splice(resultIndex, 0, file)

                resultsBox.insertBefore(
                    resultElement,
                    resultsBox.children[resultIndex]
                )
            }
        }
    }

    setSize = function(size) {
        maxSize = size

        for (let element of resultsBox.children) {
            if (element.data.width / element.data.height > 1) {
                element.firstChild.style.width = element.lastChild.style.width =
                    maxSize + 'px'

                element.firstChild.style.height =
                    element.data.height * (maxSize / element.data.width) + 'px'
            } else {
                element.firstChild.style.height = maxSize + 'px'

                element.firstChild.style.width = element.lastChild.style.width =
                    element.data.width * (maxSize / element.data.height) + 'px'
            }
        }
    }

    searchInput.addEventListener('input', () => {
        search.terms = searchInput.value.split(' ')
        folders.forEach(folder => folder.updateSearch())
    })
}

let addSavedFolder

//Folder UI
{
    const folderList = document.getElementById('active-folders')
    const savedFolderList = document.getElementById('saved-folders')

    const addFolderButton = document.getElementById('add-folder')

    function searchFolder(folder) {
        for (let i = 0; i < folder.files.length; i++) {
            checkSearchDisplay(folder.files[i])
        }
    }

    function onFolderChange(folder, event, file) {
        //TODO
    }

    function updateFolder(folder, subDirectory = '') {
        fs.readdir(
            path.join(folder.path, subDirectory),
            (error, contentList) => {
                if (error) {
                    return console.error(
                        'Could not search directory',
                        subDirectory,
                        'in folder',
                        folder,
                        error
                    )
                }

                async.each(
                    contentList,
                    (item, callback) => {
                        let fullPath = path.join(
                            folder.path,
                            subDirectory,
                            item
                        )

                        fs.stat(fullPath, (error, stats) => {
                            if (error) {
                                console.error(
                                    'Could not stat item',
                                    item,
                                    'in directory',
                                    subDirectory,
                                    'in folder',
                                    folder,
                                    error
                                )

                                return callback()
                            }

                            if (stats.isFile()) {
                                if (isValidImage(item)) {
                                    let size = imageSize(fullPath)

                                    folder.files.push({
                                        name: path.basename(
                                            item,
                                            path.extname(item)
                                        ),

                                        path: fullPath,

                                        folders: subDirectory.split(path.sep),

                                        width: size.width || 0,
                                        height: size.height || 0,

                                        extension: path
                                            .extname(item)
                                            .toLowerCase()
                                    })

                                    checkSearchDisplay(
                                        folder.files[folder.files.length - 1]
                                    )
                                }
                            } else if (stats.isDirectory()) {
                                updateFolder(
                                    folder,
                                    path.join(subDirectory, item)
                                )
                            }
                        })
                    },
                    error => {}
                )
            }
        )
    }

    function removeFolder(folderPath) {
        let index = folders.findIndex(folder => folder.path === folderPath)

        if (index === -1) {
            return false
        }

        for (let i = 0; i < folders[index].files.length; i++) {
            removeSearchDisplay(folders[index].files[i])
        }

        folders[index].watcher.close()

        folders.splice(index, 1)
        folderList.removeChild(folderList.children[index])
    }

    function addFolder(folderPath) {
        if (!path.isAbsolute(folderPath)) {
            return false
        }

        let parentFolder = false
        let childFolders = []
        for (let i = 0; i < folders.length; i++) {
            if (folders[i].path === folderPath) {
                return false
            } else if (folderPath.startsWith(folders[i].path)) {
                parentFolder = folders[i]
            } else if (folders[i].path.startsWith(folderPath)) {
                childFolders.push(folders[i])
            }
        }

        if (parentFolder) {
            dialog.showMessageBox(
                thisWindow,
                {
                    type: 'question',

                    title: 'Remove "' + parentFolder.name + '"?',
                    message:
                        '"' +
                        path.basename(folderPath) +
                        '" is a sub-directory of "' +
                        parentFolder.name +
                        '".',
                    detail:
                        'Do you want to remove "' + parentFolder.name + '"?',

                    noLink: true,

                    buttons: ['Remove', 'Cancel'],
                    defaultId: 1,
                    cancelId: 1
                },
                buttonIndex => {
                    if (buttonIndex === 0) {
                        removeFolder(parentFolder.path)

                        addFolder(folderPath)
                    }
                }
            )

            return
        }

        if (childFolders.length !== 0) {
            dialog.showMessageBox(
                thisWindow,
                {
                    type: 'question',

                    title:
                        'Replace ' +
                        (childFolders.length === 1
                            ? '"' + childFolders[0].name + '"'
                            : 'sub-directories') +
                        '?',
                    message:
                        'Existing folder' +
                        (childFolders.length === 1 ? ' ' : 's ') +
                        childFolders
                            .map(folder => '"' + folder.name + '"')
                            .join(', ') +
                        (childFolders.length === 1
                            ? ' is a sub-directory'
                            : ' are sub-directories') +
                        ' of "' +
                        path.basename(folderPath) +
                        '".',
                    detail:
                        'Do you want to remove ' +
                        (childFolders.length === 1
                            ? '"' + childFolders[0].name + '"'
                            : 'them') +
                        ' and replace with "' +
                        path.basename(folderPath) +
                        '"?',

                    noLink: true,

                    buttons: ['Replace', 'Cancel'],
                    defaultId: 1,
                    cancelId: 1
                },
                buttonIndex => {
                    if (buttonIndex === 0) {
                        for (let i = 0; i < childFolders.length; i++) {
                            removeFolder(childFolders[i].path)
                        }

                        addFolder(folderPath)
                    }
                }
            )

            return
        }

        let folder = {
            name: path.basename(folderPath),
            path: folderPath,

            files: []
        }

        folder.updateSearch = searchFolder.bind(null, folder)

        folder.watcher = fs.watch(
            folderPath,
            {
                persistent: false,
                recursive: true,
                encoding: 'utf8'
            },
            onFolderChange.bind(null, folder)
        )

        folder.watcher.on('close', event => {
            console.log('Watcher closed!', event)
        })
        folder.watcher.on('error', error => {
            console.log('Watcher error!', error)
        })

        updateFolder(folder)

        folders.push(folder)

        let element = document.createElement('div')
        element.appendChild(document.createElement('button'))
        element.firstChild.addEventListener(
            'click',
            toggleSaved.bind(null, folderPath)
        )
        element.firstChild.className = 'save'
        element.firstChild.title = 'Save ' + folderPath

        element.appendChild(document.createElement('span'))
        element.lastChild.textContent = folder.name
        element.lastChild.title = folderPath

        element.appendChild(document.createElement('button'))
        element.lastChild.addEventListener(
            'click',
            removeFolder.bind(null, folderPath)
        )
        element.lastChild.textContent = '−'
        element.lastChild.title = 'Remove ' + folderPath

        if (userOptions.savedFolders.includes(folderPath)) {
            element.className = 'saved'
        }

        folderList.appendChild(element)
    }

    function toggleSaved(folderPath) {
        if (!path.isAbsolute(folderPath)) {
            return false
        }

        if (userOptions.savedFolders.includes(folderPath)) {
            let index = userOptions.savedFolders.indexOf(folderPath)

            userOptions.savedFolders.splice(index, 1)
            savedFolderList.removeChild(savedFolderList.children[index])

            for (let i = 0; i < folders.length; i++) {
                if (folders[i].path === folderPath) {
                    folderList.children[i].className = ''
                }
            }
        } else {
            userOptions.savedFolders.push(folderPath)

            let element = document.createElement('div')
            element.className = 'saved'

            element.appendChild(document.createElement('button'))
            element.firstChild.addEventListener(
                'click',
                toggleSaved.bind(null, folderPath)
            )
            element.firstChild.className = 'save'
            element.firstChild.title = 'Un-save ' + folderPath

            element.appendChild(document.createElement('span'))
            element.lastChild.textContent = path.basename(folderPath)
            element.lastChild.title = folderPath

            element.appendChild(document.createElement('button'))
            element.lastChild.addEventListener(
                'click',
                addFolder.bind(null, folderPath)
            )
            element.lastChild.textContent = '+'
            element.lastChild.title = 'Add ' + folderPath

            savedFolderList.appendChild(element)

            for (let i = 0; i < folders.length; i++) {
                if (folders[i].path === folderPath) {
                    folderList.children[i].className = 'saved'
                }
            }
        }

        userOptions.save()
    }

    addSavedFolder = folderPath => {
        if (!userOptions.savedFolders.includes(folderPath)) {
            toggleSaved(folderPath)
        }
    }

    addFolderButton.addEventListener('click', () => {
        dialog.showOpenDialog(
            thisWindow,
            {
                title: 'Add Folder',
                buttonLabel: 'Add',

                properties: ['openDirectory', 'multiSelections']
            },
            paths => {
                if (!Array.isArray(paths)) {
                    return false
                }

                for (let i = 0; i < paths.length; i++) {
                    addFolder(paths[i])
                }
            }
        )
    })
}

//Window UI
{
    const maximizeButton = document.getElementById('maximize-window')

    let maximized = false
    let maximizeTime = 0

    document.getElementById('minimize-window').addEventListener('click', () => {
        thisWindow.minimize()
    })

    maximizeButton.addEventListener('click', () => {
        if (maximized) {
            thisWindow.unmaximize()
            maximizeButton.textContent = '🗖'
        } else {
            thisWindow.maximize()
            maximizeButton.textContent = '🗗'

            maximizeTime = Date.now()
        }

        maximized = !maximized
    })

    document.getElementById('close-window').addEventListener('click', () => {
        thisWindow.close()
    })

    let setup = false
    function setupMaximize() {
        if (setup) {
            return false
        }
        setup = true

        if (thisWindow.isMaximized()) {
            maximizeButton.textContent = '🗗'
            maximized = true
        }

        let onUnMax = () => {
            maximized = false
            maximizeButton.textContent = '🗖'
        }

        thisWindow.on('unmaximize', onUnMax)
        thisWindow.on('resize', () => {
            if (Date.now() - maximizeTime > 100) {
                onUnMax()
            }
        })
        thisWindow.on('move', () => {
            if (Date.now() - maximizeTime > 100) {
                onUnMax()
            }
        })

        thisWindow.on('maximize', () => {
            maximized = true
            maximizeButton.textContent = '🗗'

            maximizeTime = Date.now()
        })
    }

    thisWindow = BrowserWindow.getFocusedWindow()

    if (thisWindow) {
        console.log(thisWindow)
        setupMaximize()
    } else {
        window.addEventListener(
            'focus',
            () => {
                thisWindow = BrowserWindow.getFocusedWindow()

                setupMaximize()
            },
            { capture: true, once: true }
        )
        window.addEventListener(
            'click',
            () => {
                thisWindow = BrowserWindow.getFocusedWindow()

                setupMaximize()
            },
            { capture: true, once: true }
        )
    }
}

fs.readFile(
    path.join(app.getPath('userData'), 'userOptions.json'),
    'utf8',
    (error, content) => {
        if (error) {
            return console.error(error)
        }

        try {
            let data = JSON.parse(content)

            if (Array.isArray(data.savedFolders)) {
                for (let i = 0; i < data.savedFolders.length; i++) {
                    addSavedFolder(data.savedFolders[i])
                }
            }
        } catch (error) {
            console.error(error)
        }
    }
)
