const { remote, ipcRenderer } = require('electron')

const { app, clipboard, dialog, Menu, MenuItem, nativeImage, shell } = remote
const fs = require('fs')
const path = require('path')

const folders = [
    /*
        {
            name: '..',
            path: '..',

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

    results: [],

    update: () => {
        for (let i = 0; i < folders.length; i++) {
            folders[i].updateSearch()
        }
    }
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

//Search UI
{
    userOptions.add('searchResultsSize', 200)

    userOptions.add('flickScroll', true)

    const searchInput = document.getElementById('search-box')
    const ignoreInput = document.getElementById('ignore-box')
    const resultSizeInput = document.getElementById('result-size')
    const showOptionsButton = document.getElementById('show-options')

    const flickScrollInput = document.getElementById('flick-scroll')

    const searchOptions = document.getElementById('search-options')
    searchOptions.style.display = 'none'

    const resultsBox = document.getElementById('results')

    let optionsShown = false

    {
        /*
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
        let rowHeight = 0
        let maxRowHeight = 0

        let rows = []

        let updateRequested = false

        function updateResultsSize() {
            frameRequested = false
            columnCount = Math.max(
                1,
                Math.round(
                    resultsBox.clientWidth / userOptions.searchResultsSize
                )
            )

            columnWidth =
                ~~(resultsBox.clientWidth / columnCount) - resultSpacing

            rowHeight = columnWidth + resultAddHeight

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
                elem.appendChild(document.createElement('label'))
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
                    while (
                        resultsBox.children[rowIndex].childElementCount > 0
                    ) {
                        resultNodes.push(
                            resultsBox.children[rowIndex].children[0]
                        )
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
                for (
                    let rowIndex = rows.length;
                    rowIndex < rowCount;
                    rowIndex++
                ) {
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

        */
    }

    const resultNodes = []
    const rowNodes = []

    const userViewBox = {
        top: 0,
        height: 0
    }

    //Gutter size between results (and edge)
    const imageSpacing = 6
    const imageLabelHeight = 20 + imageSpacing

    const extraVisibleRows = 1.5

    const maxExtraRows = 15

    const visibleRows = {
        start: 0,
        end: 0,
        userStart: 0,
        userEnd: 0
    }

    const imagesToLoad = []

    let columnCount = 0
    let columnWidth = 0
    let rowHeight = 0

    let imageSize = 0

    let needsUpdate = true
    let needsSizeUpdate = true
    let needsLoad = true

    function loadImages() {
        let img

        for (let i = 0; i < imagesToLoad.length; i++) {
            if (
                imagesToLoad[i].rowIndex >= visibleRows.userStart &&
                imagesToLoad[i].rowIndex <= visibleRows.userEnd
            ) {
                img = imagesToLoad.splice(i, 1)[0]

                break
            }
        }

        if (!img) {
            img = imagesToLoad.pop()
        }

        img.src = img.title

        if (imagesToLoad.length > 0) {
            requestAnimationFrame(loadImages)
        } else {
            needsLoad = true
        }
    }

    function getNode(resultIndex, rowIndex) {
        if (resultNodes.length > 0) {
            return setNode(resultNodes.pop(), resultIndex)
        }

        let elem = document.createElement('div')
        elem.appendChild(document.createElement('img'))
        elem.appendChild(document.createElement('label'))

        elem.firstChild.alt = ' '

        return setNode(elem, resultIndex, rowIndex)
    }
    function getRowNode() {
        let elem

        if (rowNodes.length > 0) {
            elem = rowNodes.pop()
        } else {
            elem = document.createElement('div')
            elem.className = 'row'
        }

        elem.style.height = rowHeight + 'px'
        elem.style.width = columnWidth * columnCount + 'px'

        return elem
    }

    function updateNodeSize(node, index) {
        node.style.width = columnWidth + 'px'
        node.lastChild.style.width = columnWidth + 'px'

        if (search.results[index].height / search.results[index].width > 1) {
            node.firstChild.style.width =
                imageSize *
                    (search.results[index].width /
                        search.results[index].height) +
                'px'
            node.firstChild.style.height = imageSize + 'px'
        } else {
            node.firstChild.style.width = imageSize + 'px'
            node.firstChild.style.height =
                imageSize *
                    (search.results[index].height /
                        search.results[index].width) +
                'px'
        }
    }

    function setNode(node, resultIndex, rowIndex = -1) {
        if (node.firstChild.title === search.results[resultIndex].path) {
            return node
        }

        node.firstChild.title = search.results[resultIndex].path

        node.lastChild.textContent = search.results[resultIndex].name

        node.style.width = columnWidth + 'px'
        node.lastChild.style.width = columnWidth + 'px'

        if (
            search.results[resultIndex].height /
                search.results[resultIndex].width >
            1
        ) {
            node.firstChild.style.width =
                imageSize *
                    (search.results[resultIndex].width /
                        search.results[resultIndex].height) +
                'px'
            node.firstChild.style.height = imageSize + 'px'
        } else {
            node.firstChild.style.width = imageSize + 'px'
            node.firstChild.style.height =
                imageSize *
                    (search.results[resultIndex].height /
                        search.results[resultIndex].width) +
                'px'
        }

        node.firstChild.imgWidth = search.results[resultIndex].width
        node.firstChild.imgHeight = search.results[resultIndex].height

        node.firstChild.src = ''
        node.firstChild.rowIndex = rowIndex

        if (!imagesToLoad.includes(node.firstChild)) {
            imagesToLoad.push(node.firstChild)
        }

        if (needsLoad) {
            needsLoad = false
            requestAnimationFrame(loadImages)
        }

        return node
    }

    function updateVisibleRows() {
        needsUpdate = true

        let startIndex = Math.max(
            0,
            Math.floor(
                (userViewBox.top - rowHeight * extraVisibleRows) / rowHeight
            )
        )

        let endIndex = Math.ceil(
            Math.min(
                (userViewBox.top +
                    userViewBox.height +
                    rowHeight * extraVisibleRows) /
                    rowHeight,
                search.results.length / columnCount
            )
        )

        //Add extra rows as needed
        while (endIndex >= resultsBox.childElementCount) {
            resultsBox.appendChild(getRowNode())
        }

        //Remove rows as needed
        while (
            resultsBox.childElementCount >
            Math.min(
                endIndex + maxExtraRows,
                Math.ceil(search.results.length / columnCount) + 1
            )
        ) {
            rowNodes.push(resultsBox.lastChild)
            resultsBox.removeChild(resultsBox.lastChild)
        }

        for (
            let i = visibleRows.start;
            i <= visibleRows.end && i < resultsBox.childElementCount;
            i++
        ) {
            if (i < startIndex || i > endIndex) {
                for (
                    let j = 0;
                    j < resultsBox.children[i].childElementCount;
                    j++
                ) {
                    resultsBox.children[i].children[j].style.display = 'none'
                }
            }
        }

        for (let i = startIndex; i <= endIndex; i++) {
            let resultIndex = columnCount * i

            //Update all current results in row
            for (
                let j = 0;
                j < resultsBox.children[i].childElementCount &&
                resultIndex + j < search.results.length;
                j++
            ) {
                setNode(resultsBox.children[i].children[j], resultIndex + j, i)

                resultsBox.children[i].children[j].style.display = ''
            }

            //Add all other results, if there are more results than current nodes
            for (
                let j = resultsBox.children[i].childElementCount;
                j < columnCount && resultIndex + j < search.results.length;
                j++
            ) {
                resultsBox.children[i].appendChild(getNode(resultIndex + j, i))

                resultsBox.children[i].children[j].style.display = ''
            }

            //Hide all extra children in row
            for (
                let j = Math.max(0, search.results.length - resultIndex + 1);
                j < resultsBox.children[i].childElementCount;
                j++
            ) {
                resultsBox.children[i].children[j].style.display = 'none'
            }
        }

        visibleRows.start = startIndex
        visibleRows.end = endIndex

        visibleRows.userStart = Math.max(
            0,
            Math.floor((userViewBox.top - rowHeight) / rowHeight)
        )

        visibleRows.userEnd = Math.ceil(
            (userViewBox.top + userViewBox.height) / rowHeight
        )
    }

    function updateRows() {
        if (needsUpdate) {
            needsUpdate = false
            requestAnimationFrame(updateVisibleRows)
        }
    }

    function updateResultsSize() {
        needsSizeUpdate = true

        let oldColumnCount = columnCount

        columnCount = Math.max(
            1,
            Math.round(resultsBox.clientWidth / userOptions.searchResultsSize)
        )

        columnWidth = ~~(resultsBox.clientWidth / columnCount) - imageSpacing

        imageSize = columnWidth - imageSpacing

        rowHeight = columnWidth + imageLabelHeight

        userViewBox.top = resultsBox.scrollTop
        userViewBox.height = resultsBox.offsetHeight

        if (columnCount < oldColumnCount) {
            for (let i = 0; i < resultsBox.childElementCount; i++) {
                resultsBox.children[i].style.height = rowHeight + 'px'
                resultsBox.children[i].style.width =
                    columnWidth * columnCount + 'px'

                while (resultsBox.children[i].childElementCount > columnCount) {
                    resultNodes.push(resultsBox.children[i].lastChild)

                    resultsBox.children[i].removeChild(
                        resultsBox.children[i].lastChild
                    )
                }

                for (
                    let j = 0;
                    j < resultsBox.children[i].childElementCount &&
                    columnCount * i + j < search.results.length;
                    j++
                ) {
                    resultsBox.children[i].children[j].firstChild.rowIndex = i

                    updateNodeSize(
                        resultsBox.children[i].children[j],
                        i * columnCount + j
                    )
                }
            }
        } else {
            for (let i = 0; i < resultsBox.childElementCount; i++) {
                resultsBox.children[i].style.height = rowHeight + 'px'
                resultsBox.children[i].style.width =
                    columnWidth * columnCount + 'px'

                for (
                    let j = 0;
                    j < resultsBox.children[i].childElementCount &&
                    columnCount * i + j < search.results.length;
                    j++
                ) {
                    resultsBox.children[i].children[j].firstChild.rowIndex = i

                    updateNodeSize(
                        resultsBox.children[i].children[j],
                        i * columnCount + j
                    )
                }
            }
        }

        if (oldColumnCount !== columnCount) {
            updateRows()
        }
    }

    onResize = () => {
        if (needsSizeUpdate) {
            needsSizeUpdate = false
            requestAnimationFrame(updateResultsSize)
        }
    }

    removeSearchDisplay = function(file) {
        let index = search.results.indexOf(file)

        if (index !== -1) {
            search.results.splice(index, 1)

            updateRows()
        }
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
                    missed += search.terms[i].length / 4 + 1
                    missCount += 1
                }
            }
        }

        if (missCount <= Math.round(search.terms.length / 3)) {
            file.searchScore = index + missed * 4

            let resultIndex = search.results.findIndex(
                item => item.searchScore >= file.searchScore
            )

            if (resultIndex === -1) {
                search.results.push(file)
            } else {
                search.results.splice(resultIndex, 0, file)
            }

            updateRows()
        }
    }

    searchInput.addEventListener('input', () => {
        search.terms = searchInput.value.toLowerCase().split(' ')

        //Remove all empty ignore terms
        for (let i = search.terms.length - 1; i >= 0; i--) {
            if (search.terms[i].trim() === '') {
                search.terms.splice(i, 1)
            }
        }

        search.update()
    })
    ignoreInput.addEventListener('input', () => {
        search.ignore = ignoreInput.value.toLowerCase().split(' ')

        //Remove all empty ignore terms
        for (let i = search.ignore.length - 1; i >= 0; i--) {
            if (search.ignore[i].trim() === '') {
                search.ignore.splice(i, 1)
            }
        }

        search.update()
    })

    showOptionsButton.addEventListener('click', () => {
        optionsShown = !optionsShown

        if (optionsShown) {
            searchOptions.style.display = ''
            showOptionsButton.textContent = '⚙'
        } else {
            searchOptions.style.display = 'none'
            showOptionsButton.textContent = '⛭'
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

    window.addEventListener('resize', onResize)

    resultsBox.addEventListener('scroll', () => {
        userViewBox.top = resultsBox.scrollTop

        updateRows()
    })

    //Mouse scrolling (click, and flick)
    {
        let mouseDown = false
        let scrollOffset = 0

        let flickScrollSpeed = 0

        let needsScrollUpdate = true

        function updateScroll() {
            needsScrollUpdate = true

            resultsBox.scrollTop += scrollOffset
            scrollOffset = 0
        }
        function flickScroll() {
            scrollOffset -= flickScrollSpeed

            flickScrollSpeed *= 0.93

            if (needsScrollUpdate) {
                needsScrollUpdate = false
                requestAnimationFrame(updateScroll)
            }

            if (flickScrollSpeed < -1 || flickScrollSpeed > 1) {
                setTimeout(flickScroll, 20)
            }
        }

        flickScrollInput.addEventListener('change', event => {
            userOptions.change('flickScroll', flickScrollInput.checked)
        })

        resultsBox.addEventListener('mousedown', () => {
            flickScrollSpeed = 0

            if (event.target.tagName !== 'IMG') {
                mouseDown = true
            }
        })
        window.addEventListener('mousemove', event => {
            if (mouseDown) {
                scrollOffset -= event.movementY

                flickScrollSpeed = (flickScrollSpeed + event.movementY) / 2

                if (needsScrollUpdate) {
                    needsScrollUpdate = false
                    requestAnimationFrame(updateScroll)
                }
            }
        })
        window.addEventListener('mouseup', () => {
            mouseDown = false

            if (flickScrollSpeed !== 0 && userOptions.flickScroll) {
                flickScroll()
            }
        })
        window.addEventListener('blur', () => {
            mouseDown = false
        })
    }

    onUserOptionsLoad.push(() => {
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

        if (typeof userOptions.flickScroll !== 'boolean') {
            userOptions.flickScroll = true
        }

        userOptions.searchResultsSize = ~~userOptions.searchResultsSize

        resultSizeInput.value = userOptions.searchResultsSize

        flickScrollInput.checked = userOptions.flickScroll

        onResize()
    })
}

//Folder UI
{
    userOptions.add('folders', [])
    userOptions.add('savedFolders', [])
    userOptions.add('showFolders', true)

    const foldersElement = document.getElementById('folders')

    const folderList = document.getElementById('active-folders')
    const savedFolderList = document.getElementById('saved-folders')

    const addFolderButton = document.getElementById('add-folder')
    const showFoldersButton = document.getElementById('show-folders')

    const altDrag = document.getElementById('alt-drag')

    function searchFolder(folder) {
        for (let i = 0; i < folder.files.length; i++) {
            checkSearchDisplay(folder.files[i])
        }
    }

    function removeFolder(folderPath) {
        let index = folders.findIndex(folder => folder.path === folderPath)

        if (index === -1) {
            return false
        }

        folders[index].removed = true

        for (let i = 0; i < folders[index].files.length; i++) {
            removeSearchDisplay(folders[index].files[i])
        }

        folders.splice(index, 1)
        folderList.removeChild(folderList.children[index])

        ipcRenderer.send('remove-folder', folderPath)

        userOptions.change('folders', folders.map(folder => folder.path))
    }

    function addFolder(folderPath, callback, save = true) {
        if (!path.isAbsolute(folderPath)) {
            if (typeof callback === 'function') {
                callback(false)
            }

            return false
        }

        let parentFolder = false
        let childFolders = []
        for (let i = 0; i < folders.length; i++) {
            if (folders[i].path === folderPath) {
                if (typeof callback === 'function') {
                    callback(false)
                }

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

                        addFolder(folderPath, callback)
                    } else {
                        if (typeof callback === 'function') {
                            callback(false)
                        }
                    }
                }
            )

            return
        }

        if (childFolders.length !== 0) {
            let dialogMessage = ''
            let dialogDetail = ''

            let maxListCount = 5

            if (childFolders.length === 1) {
                dialogMessage =
                    'Existing folder "' +
                    childFolders[0].name +
                    '" is a sub-folder of "' +
                    path.basename(folderPath) +
                    '".'

                dialogDetail =
                    'Do you want to remove "' +
                    childFolders[0].name +
                    '" and replace it with "' +
                    path.basename(folderPath) +
                    '"?'
            } else {
                let listedFolders = childFolders.slice(0, maxListCount - 1)

                let folderNames = listedFolders
                    .map(folder => '"' + folder.name + '"')
                    .join(', ')

                dialogMessage = 'Existing folders ' + folderNames + ', and '

                if (childFolders.length === maxListCount) {
                    dialogMessage +=
                        ' "' + childFolders[maxListCount - 1].name + '"'
                } else {
                    dialogMessage +=
                        (childFolders.length - maxListCount + 1).toString() +
                        ' others'
                }
                dialogMessage +=
                    ' are sub-folders of "' + path.basename(folderPath) + '".'

                dialogDetail =
                    'Do you want to remove the ' +
                    childFolders.length.toString() +
                    ' sub-folders and replace them with "' +
                    path.basename(folderPath) +
                    '"?'
            }

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
                    message: dialogMessage,
                    detail: dialogDetail,

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

                        addFolder(folderPath, callback)
                    } else {
                        if (typeof callback === 'function') {
                            callback(false)
                        }
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

        ipcRenderer.send('add-folder', folderPath)

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

        if (typeof callback === 'function') {
            callback(true)
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

    ipcRenderer.on('remove-folder', (event, folderPath) => {
        removeFolder(folderPath)
    })
    ipcRenderer.on(
        'add-to-folder',
        (event, folderPath, changeType, fileList) => {
            let index = folders.findIndex(folder => folder.path === folderPath)

            if (index === -1) {
                return false
            }

            for (let i = 0; i < fileList.length; i++) {
                folders[index].files.push(fileList[i])

                checkSearchDisplay(fileList[i])
            }
        }
    )

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

                let addNext = () => {
                    if (paths.length === 0) {
                        return false
                    }

                    addFolder(paths.pop(), addNext)
                }

                addNext()
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
            addFolder(userOptions.folders[folderIndex], null, false)
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

    const alwaysOnTopButton = document.getElementById('always-top')

    thisWindow = remote.getCurrentWindow()

    let maximized = false

    alwaysOnTopButton.addEventListener('click', event => {
        if (thisWindow.isAlwaysOnTop()) {
            thisWindow.setAlwaysOnTop(false)
            alwaysOnTopButton.textContent = 'a'
        } else {
            thisWindow.setAlwaysOnTop(true)

            alwaysOnTopButton.textContent = 'A'
        }
    })

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

    setupMaximize()
}

//Hover UI
{
    userOptions.add('invertControl', false)
    userOptions.add('previewOpacity', 1)
    userOptions.add('previewMaxSize', 85)

    const resultsBox = document.getElementById('results')

    const previewElement = document.getElementById('hover-preview')
    const imagePreview = document.getElementById('image-preview')

    const invertControlInput = document.getElementById('invert-preview-control')
    const previewOpacityInput = document.getElementById('preview-opacity')
    const previewMaxSizeInput = document.getElementById('preview-max-size')

    let needsMove = true
    let needsUpdate = true

    let currentImage = {
        node: false,
        file: null,

        show: false,

        width: 0,
        height: 0,

        displayHalfWidth: 0,
        displayHalfHeight: 0
    }

    let position = {
        minTop: 0,
        top: 0,
        maxTop: 0,

        minLeft: 0,
        left: 0,
        maxLeft: 0
    }

    function updatePosition() {
        needsMove = true

        previewElement.style.top =
            Math.ceil(
                Math.max(
                    currentImage.displayHalfHeight,
                    Math.min(
                        position.top,
                        window.innerHeight - currentImage.displayHalfHeight
                    )
                )
            ) + 'px'

        previewElement.style.left =
            Math.ceil(
                Math.max(
                    currentImage.displayHalfWidth,
                    Math.min(
                        position.left,
                        window.innerWidth - currentImage.displayHalfWidth
                    )
                )
            ) + 'px'
    }

    function updateDisplay() {
        needsUpdate = true

        previewElement.style.display = currentImage.show ? '' : 'none'

        if (!currentImage.file) {
            return false
        }

        imagePreview.style.display = ''
        imagePreview.src = currentImage.file

        let bounds = resultsBox.getBoundingClientRect()

        let imageMaxWidth = Math.floor(
            Math.min(
                window.innerWidth,
                bounds.height * (userOptions.previewMaxSize / 100)
            )
        )
        let imageMaxHeight = Math.floor(
            Math.min(
                window.innerHeight,
                bounds.width * (userOptions.previewMaxSize / 100)
            )
        )

        let imageDisplayScale =
            Math.min(imageMaxWidth, currentImage.width) / currentImage.width

        if (
            imageMaxWidth / imageMaxHeight >
            currentImage.width / currentImage.height
        ) {
            imageDisplayScale =
                Math.min(imageMaxHeight, currentImage.height) /
                currentImage.height
        }

        previewElement.style.maxWidth =
            currentImage.width * imageDisplayScale + 'px'
        previewElement.style.maxHeight =
            currentImage.height * imageDisplayScale + 'px'

        currentImage.displayHalfHeight =
            (currentImage.height * imageDisplayScale) / 2
        currentImage.displayHalfWidth =
            (currentImage.width * imageDisplayScale) / 2
    }

    imagePreview.addEventListener('load', () => {
        requestAnimationFrame(() => {
            if (currentImage.show && currentImage.node) {
                imagePreview.style.display = ''
            }
        })
    })

    invertControlInput.addEventListener('change', () => {
        userOptions.change('invertControl', invertControlInput.checked)
    })
    previewOpacityInput.addEventListener('input', () => {
        let value = parseFloat(previewOpacityInput.value)

        if (
            typeof value === 'number' &&
            isFinite(value) &&
            value >= 0.1 &&
            value <= 1
        ) {
            value = Math.round(value * 100) / 100

            userOptions.change('previewMaxSize', value)

            previewElement.style.opacity = userOptions.previewOpacity
        }
    })
    previewOpacityInput.addEventListener('blur', () => {
        previewOpacityInput.value = userOptions.previewOpacity
    })
    previewMaxSizeInput.addEventListener('input', () => {
        let value = parseFloat(previewMaxSizeInput.value)

        if (
            typeof value === 'number' &&
            isFinite(value) &&
            value >= 5 &&
            value <= 200
        ) {
            value = Math.round(value)

            userOptions.change('previewMaxSize', value)

            if (needsUpdate) {
                needsUpdate = false
                requestAnimationFrame(updateDisplay)
            }
        }
    })
    previewMaxSizeInput.addEventListener('blur', () => {
        previewMaxSizeInput.value = userOptions.previewMaxSize
    })

    resultsBox.addEventListener('mousemove', event => {
        position.top = event.clientY
        position.left = event.clientX

        if (currentImage.node) {
            if (
                (event.ctrlKey !== userOptions.invertControl) !==
                currentImage.show
            ) {
                currentImage.show = event.ctrlKey !== userOptions.invertControl

                if (needsUpdate) {
                    needsUpdate = false
                    requestAnimationFrame(updateDisplay)
                }
            }

            if (needsMove) {
                needsMove = false
                requestAnimationFrame(updatePosition)
            }
        }
    })

    resultsBox.addEventListener(
        'mouseover',
        event => {
            if (
                event.target.tagName === 'IMG' ||
                event.target.tagName === 'LABEL'
            ) {
                currentImage.node = event.target.parentNode
            } else if (
                event.target.firstElementChild &&
                event.target.firstElementChild.tagName === 'IMG'
            ) {
                currentImage.node = event.target
            } else {
                return false
            }

            currentImage.file = currentImage.node.firstElementChild.title

            currentImage.width = currentImage.node.firstElementChild.imgWidth
            currentImage.height = currentImage.node.firstElementChild.imgHeight

            currentImage.show = event.ctrlKey !== userOptions.invertControl

            if (needsUpdate) {
                needsUpdate = false
                requestAnimationFrame(updateDisplay)
            }
        },
        true
    )

    resultsBox.addEventListener(
        'mouseout',
        event => {
            if (
                event.target.className === 'row' ||
                event.target.tagName === 'IMG' ||
                event.target === currentImage.node ||
                event.target === resultsBox
            ) {
                currentImage.show = false
                currentImage.file = ''
                currentImage.node = null

                if (needsUpdate) {
                    needsUpdate = false
                    requestAnimationFrame(updateDisplay)
                }
            }
        },
        true
    )

    window.addEventListener('resize', () => {
        if (needsUpdate) {
            needsUpdate = false
            requestAnimationFrame(updateDisplay)
        }
    })

    window.addEventListener('keydown', event => {
        if (currentImage.node) {
            currentImage.show = event.ctrlKey !== userOptions.invertControl

            if (needsUpdate) {
                needsUpdate = false
                requestAnimationFrame(updateDisplay)
            }
        }
    })
    window.addEventListener('keyup', event => {
        if (currentImage.node) {
            currentImage.show = event.ctrlKey !== userOptions.invertControl

            if (needsUpdate) {
                needsUpdate = false
                requestAnimationFrame(updateDisplay)
            }
        }
    })

    window.addEventListener('blur', () => {
        if (currentImage.show) {
            currentImage.show = false

            if (needsUpdate) {
                needsUpdate = false
                requestAnimationFrame(updateDisplay)
            }
        }
    })

    onUserOptionsLoad.push(() => {
        if (typeof userOptions.invertControl !== 'boolean') {
            userOptions.invertControl = false
        }
        if (
            typeof userOptions.previewOpacity !== 'number' ||
            !isFinite(userOptions.previewOpacity) ||
            userOptions.previewOpacity < 0.1 ||
            userOptions.previewOpacity > 1
        ) {
            userOptions.previewOpacity = 1
        }
        if (
            typeof userOptions.previewMaxSize !== 'number' ||
            !isFinite(userOptions.previewMaxSize) ||
            userOptions.previewMaxSize < 5 ||
            userOptions.previewMaxSize > 200
        ) {
            userOptions.previewMaxSize = 85
        }

        invertControlInput.checked = userOptions.invertControl

        previewOpacityInput.value = userOptions.previewOpacity
        previewElement.style.opacity = userOptions.previewOpacity

        previewMaxSizeInput.value = userOptions.previewMaxSize

        if (needsUpdate) {
            needsUpdate = false
            requestAnimationFrame(updateDisplay)
        }
    })
}

//Context Menu
{
    let imagePath = ''
    let folderPath = ''

    const activeFoldersNode = document.getElementById('active-folders')
    const searchNode = document.getElementById('search')
    const resultsNode = document.getElementById('results')

    const contextMenu = new Menu()

    const editItem = {
        cut: new MenuItem({ role: 'cut' }),
        copy: new MenuItem({ role: 'copy' }),
        paste: new MenuItem({ role: 'paste' }),
        selectAll: new MenuItem({ role: 'selectAll' }),
        delete: new MenuItem({ role: 'delete' })
    }
    contextMenu.append(editItem.cut)
    contextMenu.append(editItem.copy)
    contextMenu.append(editItem.paste)
    contextMenu.append(editItem.selectAll)
    contextMenu.append(editItem.delete)

    const editItems = [
        editItem.cut,
        editItem.copy,
        editItem.paste,
        editItem.selectAll,
        editItem.delete
    ]

    const copyImage = new MenuItem({
        label: 'Copy Image',

        click: () => {
            if (imagePath) {
                let ext = path.extname(imagePath).toLowerCase()

                if (
                    ext.includes('png') ||
                    ext.includes('jpg') ||
                    ext.includes('jpeg')
                ) {
                    try {
                        clipboard.writeImage(
                            nativeImage.createFromPath(imagePath)
                        )
                    } catch (error) {
                        //todo
                    }
                } else {
                    alert('Only PNG and JPEG images can be copied')
                }
            }
        }
    })
    contextMenu.append(copyImage)

    const copyImagePath = new MenuItem({
        label: 'Copy Image Path',

        click: () => {
            if (imagePath) {
                clipboard.writeText(imagePath)
            }
        }
    })
    contextMenu.append(copyImagePath)

    const openImage = new MenuItem({
        label: 'Open Image',

        click: () => {
            if (imagePath) {
                shell.openItem(imagePath)
            }
        }
    })
    contextMenu.append(openImage)

    const showImage = new MenuItem({
        label: 'Show in Folder',

        click: () => {
            if (imagePath) {
                shell.showItemInFolder(imagePath)
            }
        }
    })
    contextMenu.append(showImage)

    const imageItems = [copyImage, copyImagePath, openImage, showImage]

    const refreshFolder = new MenuItem({
        label: 'Refresh Folder',

        click: () => {
            if (folderPath) {
                let index = folders.findIndex(
                    folder => folder.path === folderPath
                )

                if (index === -1) {
                    return false
                }

                for (let i = 0; i < folders[index].files.length; i++) {
                    removeSearchDisplay(folders[index].files[i])
                }

                ipcRenderer.send('refresh-folder', folderPath)
            }
        }
    })
    contextMenu.append(refreshFolder)

    const copyFolderPath = new MenuItem({
        label: 'Copy Folder Path',

        click: () => {
            if (folderPath) {
                clipboard.writeText(folderPath)
            }
        }
    })
    contextMenu.append(copyFolderPath)

    const openFolder = new MenuItem({
        label: 'Open Folder',

        click: () => {
            if (folderPath) {
                shell.openItem(folderPath)
            }
        }
    })
    contextMenu.append(openFolder)

    contextMenu.append(new MenuItem({ type: 'separator' }))

    const updateSearch = new MenuItem({
        label: 'Refresh Search',

        click: () => {
            search.update()
        }
    })
    contextMenu.append(updateSearch)

    const removeFolders = new MenuItem({
        label: 'Remove All Folders',

        click: () => {
            for (let i = folders.length - 1; i >= 0; i--) {
                folders[i].remove()
            }
        }
    })
    contextMenu.append(removeFolders)

    const windowItem = new MenuItem({ role: 'windowMenu' })
    contextMenu.append(windowItem)

    const folderItems = [copyFolderPath, openFolder]

    document.addEventListener('contextmenu', event => {
        if (event.target.tagName === 'INPUT') {
            for (let i = 0; i < editItems.length; i++) {
                editItems[i].enabled = true
                editItems[i].visible = true
            }

            //If not text is selected, cut, copy, and delete items need to be disabled
            if (event.target.selectionStart === event.target.selectionEnd) {
                editItem.cut.enabled = false
                editItem.copy.enabled = false
                editItem.delete.enabled = false
            }
        } else {
            for (let i = 0; i < editItems.length; i++) {
                editItems[i].enabled = false
                editItems[i].visible = false
            }
        }

        imagePath = ''
        folderPath = ''

        if (event.target.tagName === 'IMG') {
            imagePath = event.target.title
        } else if (
            event.target.previousElementSibling &&
            event.target.previousElementSibling.tagName === 'IMG'
        ) {
            imagePath = event.target.previousElementSibling.title
        } else if (
            event.target.firstChild &&
            event.target.firstChild.tagName === 'IMG'
        ) {
            imagePath = event.target.firstChild.title
        }

        if (imagePath) {
            for (let i = 0; i < imageItems.length; i++) {
                imageItems[i].enabled = true
                imageItems[i].visible = true
            }
        } else {
            for (let i = 0; i < imageItems.length; i++) {
                imageItems[i].enabled = false
                imageItems[i].visible = false
            }
        }

        if (event.target.tagName === 'SPAN') {
            folderPath = event.target.title
        } else if (
            event.target.previousElementSibling &&
            event.target.previousElementSibling.tagName === 'SPAN'
        ) {
            folderPath = event.target.previousElementSibling.title
        } else if (
            event.target.nextElementSibling &&
            event.target.nextElementSibling.tagName === 'SPAN'
        ) {
            folderPath = event.target.nextElementSibling.title
        } else if (
            event.target.firstElementChild &&
            event.target.firstElementChild.nextElementSibling &&
            event.target.firstElementChild.nextElementSibling.tagName === 'SPAN'
        ) {
            folderPath = event.target.firstElementChild.nextElementSibling.title
        }

        if (folderPath) {
            for (let i = 0; i < folderItems.length; i++) {
                folderItems[i].enabled = true
                folderItems[i].visible = true
            }
        } else {
            for (let i = 0; i < folderItems.length; i++) {
                folderItems[i].enabled = false
                folderItems[i].visible = false
            }
        }

        if (
            activeFoldersNode.contains(event.target) ||
            event.target === activeFoldersNode
        ) {
            removeFolders.enabled = true
            removeFolders.visible = true
        } else {
            removeFolders.enabled = false
            removeFolders.visible = false
        }

        if (
            searchNode.contains(event.target) ||
            searchNode === event.target ||
            resultsNode.contains(event.target) ||
            resultsNode === event.target
        ) {
            updateSearch.enabled = true
            updateSearch.visible = true
        } else {
            updateSearch.enabled = false
            updateSearch.visible = false
        }

        contextMenu.popup({})
    })
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
