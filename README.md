# web3-providers-http-via-proxy
HOW TO USE:
```
const Web3 = require('web3');
const Provider = require('./web3-providers-http-via-proxy');

const web3 = new Web3(new Provider('https://bsc-dataseed4.binance.org/', 'http://user:password@1.1.1.1:10000'));

web3.eth.getTransactionCount('0xc........................', (err, txCount) => {
    if (err) {
        console.log(err);
    } else {
        console.log('getTransactionCount: ' + txCount);
    }
});
```
