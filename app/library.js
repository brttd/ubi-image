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
    ignore: [],

    results: []
}

const userOptions = {
    add: (name, value) => {
        if (
            typeof name !== 'string' ||
            name.length === 0 ||
            userOptions._keysToSave.includes(name)
        ) {
            return false
        }

        userOptions[name] = value
        userOptions._keysToSave.push(name)
    },
    change: (name, value) => {
        if (typeof name !== 'string' || name.length === 0) {
            return false
        }

        if (userOptions._keysToSave.includes(name)) {
            userOptions[name] = value
        } else {
            userOptions.add(name, value)
        }

        userOptions.save()
    },

    _keysToSave: [],
    _lastSaveTime: 0,
    _minSaveTime: 500,
    save: (force = false) => {
        if (
            force ||
            Date.now() - userOptions._lastSaveTime >= userOptions._minSaveTime
        ) {
            userOptions._lastSaveTime = Date.now()

            let data = {}
            for (
                let keyIndex = 0;
                keyIndex < userOptions._keysToSave.length;
                keyIndex++
            ) {
                data[userOptions._keysToSave[keyIndex]] =
                    userOptions[userOptions._keysToSave[keyIndex]]
            }

            data = JSON.stringify(data)

            fs.writeFile(
                path.join(app.getPath('userData'), 'userOptions.json'),
                data,
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
const onUserOptionsLoad = []

let thisWindow

let checkSearchDisplay
let removeSearchDisplay

let onResize

function isValidImage(filePath) {
    return validImageExtensions.includes(path.extname(filePath).toLowerCase())
}

//Search UI
{
    //Change to be actual result count, instead of row count
    userOptions.add('maxSearchResults', 80)
    userOptions.add('searchResultsSize', 200)

    const searchInput = document.getElementById('search-box')
    const ignoreInput = document.getElementById('ignore-box')
    const maxResultsInput = document.getElementById('max-results')
    const resultSizeInput = document.getElementById('result-size')
    const showOptionsButton = document.getElementById('show-options')

    const searchOptions = document.getElementById('search-options')
    searchOptions.style.display = 'none'

    const resultsBox = document.getElementById('results')

    const rowNodes = []
    const resultNodes = []

    const resultsViewBox = {
        top: 0,
        height: 0
    }

    //Gutter size between results (and edge)
    const resultSpacing = 6
    //Height of file name
    const resultAddHeight = 20 + resultSpacing

    let optionsShown = false

    //width/height cannot be smaller than this
    const resultMinRatio = 1
    let columnCount = 5
    let columnWidth = 0
    let maxRowHeight = 0

    let rows = []

    let updateRequested = false

    function updateResultsSize() {
        frameRequested = false
        columnCount = Math.max(
            1,
            Math.round(resultsBox.clientWidth / userOptions.searchResultsSize)
        )

        columnWidth = ~~(resultsBox.clientWidth / columnCount) - resultSpacing

        maxRowHeight = columnWidth / resultMinRatio

        resultsViewBox.top = resultsBox.scrollTop
        resultsViewBox.height = resultsBox.clientHeight
    }

    function getResultNode(file) {
        let elem

        if (resultNodes.length > 0) {
            elem = resultNodes.pop()
        } else {
            elem = document.createElement('div')
            elem.appendChild(document.createElement('img'))
            elem.appendChild(document.createElement('span'))
        }

        elem.firstChild.src = file.path
        elem.firstChild.title = file.path

        let width = columnWidth
        let height = width * (file.height / file.width)
        if (height > maxRowHeight) {
            height = maxRowHeight

            width = height * (file.width / file.height)
        }

        elem.firstChild.style.width = width + 'px'
        elem.firstChild.style.height = height + 'px'
        elem.lastChild.style.width = columnWidth + 'px'

        elem.lastChild.textContent = file.name

        elem.data = file

        return elem
    }

    function getRowHeight(rowIndex) {
        let rowHeight = 0

        for (
            let resultIndex = rowIndex * columnCount;
            resultIndex < rowIndex * columnCount + columnCount &&
            resultIndex < search.results.length;
            resultIndex++
        ) {
            let height =
                columnWidth *
                (search.results[resultIndex].height /
                    search.results[resultIndex].width)
            rowHeight = Math.max(
                height < maxRowHeight ? height : maxRowHeight,
                rowHeight
            )
        }

        return rowHeight + resultAddHeight
    }

    function populateRow(rowIndex) {
        for (
            let resultIndex = rowIndex * columnCount;
            resultIndex < rowIndex * columnCount + columnCount &&
            resultIndex < search.results.length;
            resultIndex++
        ) {
            resultsBox.children[rowIndex].appendChild(
                getResultNode(search.results[resultIndex])
            )
        }
    }

    function populateVisibleRows() {
        let totalHeight = 0
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            if (rows[rowIndex].needsRebuild) {
                while (resultsBox.children[rowIndex].childElementCount > 0) {
                    resultNodes.push(resultsBox.children[rowIndex].children[0])
                    resultsBox.children[rowIndex].removeChild(
                        resultsBox.children[rowIndex].firstChild
                    )
                }

                if (
                    totalHeight >= resultsViewBox.top - maxRowHeight &&
                    totalHeight <=
                        resultsViewBox.top +
                            resultsViewBox.height +
                            maxRowHeight
                ) {
                    rows[rowIndex].needsRebuild = false
                    populateRow(rowIndex)
                }

                totalHeight += rows[rowIndex].height
            }
        }
    }

    function makeRows(rowCount) {
        while (resultsBox.childElementCount > rowCount) {
            resultsBox.removeChild(resultsBox.lastChild)
        }
        while (resultsBox.childElementCount < rowCount) {
            resultsBox.appendChild(document.createElement('div'))
            resultsBox.lastChild.className = 'row'
        }
    }

    function rebuildRows() {
        updateRequested = false
        rows = []

        let rowCount = Math.min(
            Math.ceil(search.results.length / columnCount),
            userOptions.maxSearchResults
        )

        makeRows(rowCount)

        for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
            rows.push({
                height: getRowHeight(rowIndex),

                needsRebuild: true,

                node: resultsBox.children[rowIndex]
            })

            resultsBox.children[rowIndex].style.height =
                rows[rowIndex].height + 'px'
        }

        populateVisibleRows()
    }

    function updateRows() {
        if (!updateRequested) {
            updateRequested = true
            requestAnimationFrame(rebuildRows)
        }
    }

    let frameRequested = false
    onResize = function() {
        if (!frameRequested) {
            frameRequested = true
            updateResultsSize()
            rebuildRows()
        }
    }

    function changeMaxRowCount(max) {
        userOptions.change('maxSearchResults', max)

        let rowCount = Math.min(
            Math.ceil(search.results.length / columnCount),
            userOptions.maxSearchResults
        )

        makeRows(rowCount)

        if (rowCount > rows.length) {
            for (let rowIndex = rows.length; rowIndex < rowCount; rowIndex++) {
                rows.push({
                    height: getRowHeight(rowIndex),

                    needsRebuild: true,

                    node: resultsBox.children[rowIndex]
                })

                resultsBox.children[rowIndex].style.height =
                    rows[rowIndex].height + 'px'
            }
        } else if (rowCount < rows.length) {
            rows.length = rowCount
        }

        populateVisibleRows()
    }

    removeSearchDisplay = function(file) {
        let index = search.results.indexOf(file)
        if (index !== -1) {
            search.results.splice(index, 1)
        }

        updateRows()
    }

    checkSearchDisplay = function(file) {
        removeSearchDisplay(file)

        if (search.terms.length === 0) {
            return false
        }

        for (let i = 0; i < search.ignore.length; i++) {
            if (file.nameLower.indexOf(search.ignore[i]) !== -1) {
                return false
            }

            for (let j = 0; j < file.foldersLower.length; j++) {
                if (file.foldersLower[j].indexOf(search.ignore[i]) !== -1) {
                    return false
                }
            }
        }

        let index = 0
        let missed = 0
        let missCount = 0

        for (let i = 0; i < search.terms.length; i++) {
            let tempIndex = file.nameLower.indexOf(search.terms[i])

            if (tempIndex !== -1) {
                //If the term was in the filename, increase the filescore by the index of the term
                index +=
                    10 / (search.terms[i].length + 5) +
                    tempIndex * 0.02 * (1 + i)
            } else {
                for (let j = 0; j < file.foldersLower.length; j++) {
                    tempIndex = file.foldersLower[j].indexOf(search.terms[i])

                    if (tempIndex !== -1) {
                        index +=
                            10 / (search.terms[i].length + 5) +
                            tempIndex * 0.02 * (1 + i)
                        break
                    }
                }

                //If the search term was not in the filename, nor file folders
                if (tempIndex === -1) {
                    //Then increase the missed score, and count
                    missed += search.terms[i].length / 3 + 1
                    missCount += 1
                }
            }
        }

        if (missCount <= Math.round(search.terms.length / 3)) {
            file.searchScore = index + missed * 3

            let resultIndex = search.results.findIndex(
                item => item.searchScore >= file.searchScore
            )

            if (resultIndex === -1) {
                search.results.push(file)
            } else {
                search.results.splice(resultIndex, 0, file)
            }
        }

        updateRows()
    }

    searchInput.addEventListener('input', () => {
        search.terms = searchInput.value.toLowerCase().split(' ')

        //Remove all empty ignore terms
        for (let i = search.terms.length - 1; i >= 0; i--) {
            if (search.terms[i].trim() === '') {
                search.terms.splice(i, 1)
            }
        }

        folders.forEach(folder => folder.updateSearch())
    })
    ignoreInput.addEventListener('input', () => {
        search.ignore = ignoreInput.value.toLowerCase().split(' ')

        //Remove all empty ignore terms
        for (let i = search.ignore.length - 1; i >= 0; i--) {
            if (search.ignore[i].trim() === '') {
                search.ignore.splice(i, 1)
            }
        }

        folders.forEach(folder => folder.updateSearch())
    })

    showOptionsButton.addEventListener('click', () => {
        optionsShown = !optionsShown

        if (optionsShown) {
            searchOptions.style.display = ''
        } else {
            searchOptions.style.display = 'none'
        }
    })

    maxResultsInput.addEventListener('input', () => {
        let value = parseFloat(maxResultsInput.value)
        if (value !== ~~value) {
            maxResultsInput.value = value = ~~value
        }

        if (isFinite(value) && value > 0 && value <= 1000) {
            changeMaxRowCount(value)
        }
    })
    maxResultsInput.addEventListener('blur', () => {
        let value = parseFloat(maxResultsInput.value)

        if (!isFinite(value)) {
            value = userOptions.maxSearchResults
        }
        if (value !== ~~value) {
            value = ~~value
        }
        if (value <= 0) {
            value = 1
        } else if (value > 1000) {
            value = 1000
        }

        maxResultsInput.value = value
        if (value !== userOptions.maxSearchResults) {
            changeMaxRowCount(value)
        }
    })

    resultSizeInput.addEventListener('input', () => {
        let value = parseFloat(resultSizeInput.value)
        if (value !== ~~value) {
            resultSizeInput.value = value = ~~value
        }

        if (isFinite(value) && value >= 10 && value <= 1000) {
            userOptions.change('searchResultsSize', value)
            onResize()
        }
    })
    resultSizeInput.addEventListener('blur', () => {
        let value = parseFloat(resultSizeInput.value)

        if (!isFinite(value)) {
            value = userOptions.searchResultsSize
        }
        if (value !== ~~value) {
            value = ~~value
        }
        if (value <= 9) {
            value = 10
        } else if (value > 1000) {
            value = 1000
        }

        resultSizeInput.value = value
        if (value !== userOptions.searchResultsSize) {
            userOptions.change('searchResultsSize', value)
            onResize()
        }
    })

    updateResultsSize()

    window.addEventListener('resize', onResize)

    resultsBox.addEventListener('scroll', () => {
        resultsViewBox.top = resultsBox.scrollTop
        populateVisibleRows()
    })

    onUserOptionsLoad.push(() => {
        if (
            typeof userOptions.maxSearchResults !== 'number' ||
            !isFinite(userOptions.maxSearchResults)
        ) {
            userOptions.maxSearchResults = 80
        } else if (userOptions.maxSearchResults <= 0) {
            userOptions.maxSearchResults = 1
        } else if (userOptions.maxSearchResults > 1000) {
            userOptions.maxSearchResults = 1000
        }
        userOptions.maxSearchResults = ~~userOptions.maxSearchResults

        maxResultsInput.value = userOptions.maxSearchResults
        changeMaxRowCount(userOptions.maxSearchResults)

        if (
            typeof userOptions.searchResultsSize !== 'number' ||
            !isFinite(userOptions.searchResultsSize)
        ) {
            userOptions.searchResultsSize = 200
        } else if (userOptions.searchResultsSize < 10) {
            userOptions.searchResultsSize = 10
        } else if (userOptions.searchResultsSize > 1000) {
            userOptions.searchResultsSize = 1000
        }
        userOptions.searchResultsSize = ~~userOptions.searchResultsSize

        resultSizeInput.value = userOptions.searchResultsSize
        onResize()
    })
}

//Folder UI
{
    userOptions.add('folders', [])
    userOptions.add('savedFolders', [])

    const folderList = document.getElementById('active-folders')
    const savedFolderList = document.getElementById('saved-folders')

    const addFolderButton = document.getElementById('add-folder')

    const showFoldersButton = document.getElementById('show-folders')

    const foldersElement = document.getElementById('folders')
    const altDrag = document.getElementById('alt-drag')

    userOptions.add('showFolders', true)

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
                        "Couldn't search directory",
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
                                    "Couldn't stat item",
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
                                        nameLower:
                                            path
                                                .basename(
                                                    item,
                                                    path.extname(item)
                                                )
                                                .toLowerCase() +
                                            ' ' +
                                            path.extname(item).toLowerCase(),

                                        path: fullPath,

                                        folders: subDirectory.split(path.sep),
                                        foldersLower: subDirectory
                                            .split(path.sep)
                                            .map(folder =>
                                                folder.toLowerCase()
                                            ),

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

        userOptions.change('folders', folders.map(folder => folder.path))
    }

    function addFolder(folderPath, save = true) {
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
            console.error('Watcher error!', error)
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

        if (save) {
            userOptions.change('folders', folders.map(folder => folder.path))
        }
    }

    function getSavedFolderElement(folderPath) {
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

        return element
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

            savedFolderList.appendChild(getSavedFolderElement(folderPath))

            for (let i = 0; i < folders.length; i++) {
                if (folders[i].path === folderPath) {
                    folderList.children[i].className = 'saved'
                }
            }
        }

        userOptions.save()
    }

    function updateFoldersDisplay() {
        if (userOptions.showFolders) {
            foldersElement.style.display = 'none'
            altDrag.style.display = ''

            showFoldersButton.textContent = '🗀'
        } else {
            foldersElement.style.display = ''
            altDrag.style.display = 'none'

            showFoldersButton.textContent = '🖿'
        }

        onResize()
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

                for (let pathIndex = 0; pathIndex < paths.length; pathIndex++) {
                    addFolder(paths[pathIndex])
                }
            }
        )
    })

    showFoldersButton.addEventListener('click', () => {
        userOptions.change('showFolders', !userOptions.showFolders)

        updateFoldersDisplay()
    })

    onUserOptionsLoad.push(() => {
        if (!Array.isArray(userOptions.folders)) {
            userOptions.folders = []
        }
        if (!Array.isArray(userOptions.savedFolders)) {
            userOptions.savedFolders = []
        }

        if (typeof userOptions.showFolders !== 'boolean') {
            userOptions.showFolders = true
        }
        updateFoldersDisplay()

        //Remove all non-absolute paths
        userOptions.folders = userOptions.folders.filter(folderPath =>
            path.isAbsolute(folderPath)
        )

        userOptions.savedFolders = userOptions.savedFolders.filter(
            savedFolderPath => path.isAbsolute(savedFolderPath)
        )

        for (
            let folderIndex = 0;
            folderIndex < userOptions.folders.length;
            folderIndex++
        ) {
            addFolder(userOptions.folders[folderIndex], false)
        }

        for (
            let savedFolderIndex = 0;
            savedFolderIndex < userOptions.savedFolders.length;
            savedFolderIndex++
        ) {
            savedFolderList.appendChild(
                getSavedFolderElement(
                    userOptions.savedFolders[savedFolderIndex]
                )
            )

            for (
                let folderIndex = 0;
                folderIndex < folders.length;
                folderIndex++
            ) {
                if (
                    folders[folderIndex].path ===
                    userOptions.savedFolders[folderIndex]
                ) {
                    folderList.children[folderIndex].className = 'saved'
                }
            }
        }
    })
}

//Window UI
{
    const maximizeButton = document.getElementById('maximize-window')

    let maximized = false

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
            maximizeButton.textContent = '🗖'
            maximized = false
        }

        thisWindow.on('resize', onUnMax)
        thisWindow.on('move', onUnMax)

        thisWindow.on('unmaximize', onUnMax)

        thisWindow.on('maximize', () => {
            maximizeButton.textContent = '🗗'
            maximized = true
        })
    }

    thisWindow = remote.getCurrentWindow()

    setupMaximize()
}

fs.readFile(
    path.join(app.getPath('userData'), 'userOptions.json'),
    'utf8',
    (error, content) => {
        if (error) {
            return console.error("Couldn't load userOptions.json", error)
        }

        try {
            let data = JSON.parse(content)

            for (
                let keyIndex = 0;
                keyIndex < userOptions._keysToSave.length;
                keyIndex++
            ) {
                if (data.hasOwnProperty(userOptions._keysToSave[keyIndex])) {
                    userOptions[userOptions._keysToSave[keyIndex]] =
                        data[userOptions._keysToSave[keyIndex]]
                }
            }

            for (let i = 0; i < onUserOptionsLoad.length; i++) {
                if (typeof onUserOptionsLoad[i] === 'function') {
                    try {
                        onUserOptionsLoad[i]()
                    } catch (error) {
                        console.error(
                            "Couldn't call user option load function",
                            error
                        )
                    }
                }
            }
        } catch (error) {
            console.error("Couldn't parse userOptions.json", error)
        }
    }
)
