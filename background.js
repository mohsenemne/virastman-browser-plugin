(() => {
  chrome.runtime.onConnect.addListener(function(port) {
    port.onMessage.addListener(function(request) {
      const { operations, rev } = request

      fetch('https://adansoft.ir/virastar-api/api/v1/checker/check', {
          method: 'POST',
          cache: 'no-cache',
          headers: {
              'Content-Type': 'application/json',
              'XApiKey': '7@udpYcDk?^V2t5CDWbf8V3#ju=Jt_Ke@2eX*cmd4%@2P&-wM_rJeBd?LBTxE&HM',
          },
          redirect: 'follow',
          body: JSON.stringify({
              docId: port.name,
              requestId: "0",
              rev: rev,
              operations: operations
          }),
      }).then(res => res.json()).then(res => port.postMessage(res)).catch(reason => port.postMessage(reason))
    });
  });
})()

