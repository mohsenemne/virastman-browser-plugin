fetch(chrome.runtime.getURL("content-script/diff_match_patch.js"))

var typingTimer;
var doneTypingInterval = 2000;

TextNodesDB = []

function getOrCreateNodeToDBRecord(node) {
    for(var i=0; i<TextNodesDB.length; i++) {
        if(TextNodesDB[i].element == node) {
            return TextNodesDB[i]
        }
    }
    
    textNodesDBRecord = {
        id: Math.random().toString(36).substring(2,10),
        element: node,
        prevText: "",
        rev: 0,
        alerts: {},
    }

    TextNodesDB.push(textNodesDBRecord)

    return textNodesDBRecord
}

function updataDB(nodeDBRecord) {
    nodeDBRecord.rev += 1
    nodeDBRecord.prevText = nodeDBRecord.element.value || nodeDBRecord.element.innerText
}

function extractOperations(prevText, currentText) {
    const rx = new RegExp('%|:', 'm');
    dmp = new diff_match_patch()
    diff = dmp.diff_main(prevText, currentText)

    idx = 0
    var operations = []
    for (var i = 0; i < diff.length; i++) {
        var text = diff[i][1]
        text.replace(rx, (x) => {
			if(x === '%') return '%25';
            if(x === ':') return '%3A';
            return x;
        })

        if(diff[i][0] == 1) {
            operations.push("+" + idx.toString(36) + ":0:" + text + ":0")
        } else if(diff[i][0] ==-1) {
            operations.push("-" + idx.toString(36) + ":0:" + text + ":0")
            idx += diff[i][1].length
        } else {
            idx += diff[i][1].length
        }    
    }

    return operations
}

function getMaxZIndex() {
    return Math.max(
        ...Array.from(
            document.querySelectorAll('body *'), el => parseFloat(window.getComputedStyle(el).zIndex),
        ).filter(zIndex => !Number.isNaN(zIndex)),
        0,
    );
}

function addSideBarIfNotExists() {
    if(document.getElementById("virastman-sidebar")) {
        return
    }

    sidebar = document.createElement("div")
    sidebar.id = "virastman-sidebar"
    sidebar.className = "virastman-sidebar"

    sidebar.style.zIndex = getMaxZIndex() + 1

    closeBtn = document.createElement("a")
    closeBtn.href = "javascript:void(0)"
    closeBtn.className = "close-btn"
    closeBtn.onclick = closeSideBar
    closeBtn.text = "X"
    
    sidebar.appendChild(closeBtn)
    
    errorsContainer = document.createElement("div")
    errorsContainer.id = "virastman-alerts-container"
    errorsContainer.className = "virastman-alerts-container"
    
    sidebar.appendChild(errorsContainer)
    
    document.body.insertBefore(sidebar, document.body.firstChild)
}

function closeSideBar() {
    document.getElementById("virastman-sidebar").style.width = "0";
}

function openSideBar() {
    document.getElementById("virastman-sidebar").style.width = "250px";
}

function getAlert(textNode, alertId) {
    return getOrCreateNodeToDBRecord(textNode).alerts[alertId]
}

function updateAlertsPositionsAfterReplacement(textNode, replacementPosition, textLengthChange) {
    Object.values(getOrCreateNodeToDBRecord(textNode).alerts).forEach(a => {
        if(a.begin >= replacementPosition) {
                a.begin += textLengthChange
                a.end += textLengthChange
        }
    })
}

function addAlertToSideBar(alert, textNode) {
    var errorsContainer = document.getElementById("virastman-alerts-container")

    var alertContainerElement = document.createElement("div")
    alertContainerElement.className = "virastman-alert-container"

    var alertElement = document.createElement("div")
    alertElement.className = "virastman-alert"

    var alertTitleElement = document.createElement("h3")
    alertTitleElement.className = "virastman-alert-title"
    alertTitleElement.textContent = alert.title + ": "

    var wrongValueElement = document.createElement("p")
    wrongValueElement.className = "virastman-wrong-value"
    wrongValueElement.textContent = "«" + alert.text + "»"
    wrongValueElement.addEventListener("click", () => {
        var currentAlert = getAlert(textNode, alert.id)
        
        if(["input", "textarea"].includes(textNode.nodeName.toLowerCase())) {
            var isEmail = (textNode.type == "email")
            if(isEmail) {
                textNode.type = "text"
            }

            textNode.focus()
            textNode.setSelectionRange(currentAlert.begin, currentAlert.end)

            if(isEmail) {
                textNode.type = "email"
            }
        } else {            
            var range = document.createRange()            
            range.collapse(true)

            var sel = window.getSelection()

            var idx = 0
            var startSet = false
            let walk = document.createTreeWalker(textNode, NodeFilter.SHOW_TEXT, null, false);
            while(n = walk.nextNode()) {
                if(!startSet && n.data.length + idx >= currentAlert.begin) {
                    range.setStart(n, currentAlert.begin - idx)
                    startSet = true
                }
                if(startSet && n.data.length + idx >= currentAlert.end) {
                    range.setEnd(n, currentAlert.end - idx)
                    sel.removeAllRanges()
                    sel.addRange(range)
                    sel.removeAllRanges()
                    sel.addRange(range)
                    break;
                }
                idx += n.data.length
            }
        }
    })

    alertElement.appendChild(alertTitleElement)
    alertElement.appendChild(wrongValueElement)

    var replacementsElement = document.createElement("div")
    replacementsElement.className = "virastman-replacements-container"

    alert.replacements.forEach(replacement => {
        var replacementButton = document.createElement("button")
        replacementButton.className = "virastman-replacement-button"
        replacementButton.textContent = replacement
        replacementButton.addEventListener("click", () => {
            var textNodeDBRecord = getOrCreateNodeToDBRecord(textNode)
            var currentAlert = getAlert(textNode, alert.id)
            if(textNode.value) {
                var txt = textNode.value
                textNode.value = txt.substr(0, currentAlert.begin) + replacement + txt.substr(currentAlert.end)
            } else {
                var txt = textNode.innerText
                textNode.innerText = txt.substr(0, currentAlert.begin) + replacement + txt.substr(currentAlert.end)
            }
            updateAlertsPositionsAfterReplacement(textNode, currentAlert.end, replacement.length - (currentAlert.end - currentAlert.begin))
            
            alertContainerElement.parentNode.removeChild(alertContainerElement)
            delete textNodeDBRecord.alerts[currentAlert.id]
        })
        replacementsElement.appendChild(replacementButton)
    })
    
    var ignoreAlertContainer = document.createElement("div")
    ignoreAlertContainer.className = "virastman-ignore-alert-container"
    
    var ignoreAlertButton = document.createElement("button")
    ignoreAlertButton.className = "virastman-ignore-button"
    ignoreAlertButton.textContent = "بیخیال"
    ignoreAlertButton.addEventListener("click", () => alertContainerElement.parentNode.removeChild(alertContainerElement))
    
    ignoreAlertContainer.appendChild(ignoreAlertButton)

    alertContainerElement.appendChild(alertElement)
    alertContainerElement.appendChild(replacementsElement)
    alertContainerElement.appendChild(ignoreAlertContainer)

    errorsContainer.appendChild(alertContainerElement)
}

function isPersian(str) {
    let p = /^[\u0600-\u06FF\s]+$/;
    return p.test(str)
}

function isTextNode(elm) {
    var nodeName = elm.nodeName.toLowerCase();
    return (
        (
            nodeName === "textarea" || (nodeName === "input" && /^(?:text|search)$/i.test(elm.type))
        ) && elm.value.length > 5
    ) || (
        elm.contentEditable === 'true' &&
        elm.innerText.length > 5
    )
}

function getTextNodes(elm){
    let n;
    let textNodes = [];
    let walk = document.createTreeWalker(elm, NodeFilter.SHOW_ELEMENT, null, false);

    while(n = walk.nextNode()) {
        if(isTextNode(n) && isPersian(n.value || n.innerText)) {
            textNodes.push(n);
        }
    }
    return textNodes;
}

function handleAlerts(node, alerts) {
    alertsById = {}
    alerts.forEach(alert => {alertsById[alert.id] = alert})

    Object.assign(getOrCreateNodeToDBRecord(node).alerts, alertsById)
    
    document.getElementById("virastman-alerts-container").innerHTML = ''

    TextNodesDB.forEach(nodeDBRecord => {
        Object.keys(nodeDBRecord.alerts).sort(
            (a, b) => nodeDBRecord.alerts[a].begin > nodeDBRecord.alerts[b].begin
        ).forEach(alertId => {
            const text = nodeDBRecord.element.innerText || nodeDBRecord.element.value
            const alert = nodeDBRecord.alerts[alertId]

            if(text.substring(alert.begin, alert.end) != alert.text) {
                delete nodeDBRecord.alerts[alertId]
            }
        })

        Object.values(nodeDBRecord.alerts).forEach(alert => addAlertToSideBar(alert, nodeDBRecord.element))
    })
}

function grammarCheck() {
    addSideBarIfNotExists()
    
    let textNodes = getTextNodes(document.body)

    textNodes.forEach(node => {
        var nodeDBRecord = getOrCreateNodeToDBRecord(node)

        var port = chrome.runtime.connect({name: nodeDBRecord.id});
        
        var operations = extractOperations(nodeDBRecord.prevText, node.value || node.innerText)
        if(operations.length == 0) {
            return
        }
        port.postMessage({operations: operations, rev: nodeDBRecord.rev})
        
        updataDB(nodeDBRecord)
        
        port.onMessage.addListener(function(res, sender) {
            sender.disconnect()
            handleAlerts(node, res.alerts)
        })
    });

    openSideBar()
}

(() => {
    window.addEventListener('input', () => {
        clearTimeout(typingTimer)
        typingTimer = setTimeout(() => {grammarCheck()}, doneTypingInterval)
    }, false);

    chrome.runtime.onMessage.addListener((request, sender, response) => {
        const { source, command } = request

        if (source === "popup" && command === "show-grammar-errors") {
            addSideBarIfNotExists()
            openSideBar()
        }
        else if(source === "popup" && command === "grammar-check") {
            TextNodesDB = []
            addSideBarIfNotExists()
            document.getElementById("virastman-alerts-container").innerHTML = ''
            grammarCheck()
        }
    });
})();
