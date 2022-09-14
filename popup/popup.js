const sourceUrl = 'https://virastman.ir/';

let logoImage = document.getElementById("logo-image");
logoImage.addEventListener("click",() => {
    chrome.tabs.create({url: sourceUrl, active: true});
})

let checkGrammarButton = document.getElementById("check-grammar-button");
checkGrammarButton.addEventListener("click", () => {
    let queryOptions = { active: true, currentWindow: true };
    chrome.tabs.query(queryOptions, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { source: "popup", command: 'grammar-check'});
    });
});

let showGrammarErrorButton = document.getElementById("show-grammar-errors-button");
showGrammarErrorButton.addEventListener("click", () => {
    let queryOptions = { active: true, currentWindow: true };
    chrome.tabs.query(queryOptions, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { source: "popup", command: 'show-grammar-errors'});
    });
})
