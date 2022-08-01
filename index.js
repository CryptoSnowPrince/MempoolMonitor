require('dotenv').config();
var fs = require('fs');
var Web3 = require('web3');
var abiDecoder = require('abi-decoder');
var colors = require("colors");
var Tx = require('ethereumjs-tx').Transaction;
const winston = require('winston');
var axios = require('axios');
var BigNumber = require('big-number');

const {UNISWAP_ROUTER_ADDRESS, UNISWAP_FACTORY_ADDRESS, UNISWAP_ROUTER_ABI, UNISWAP_FACTORY_ABI, UNISWAP_POOL_ABI} = require('./consts.js');
const INPUT_TOKEN_ADDRESS = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56';
const WETH_TOKEN_ADDRESS = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56';
var BN = Web3.utils.BN;

var eth_info;
var input_token_info;
var out_token_info;
var pool_info;
const ONE_GWEI = 1e9;

var attack_started = false;
var subscription;
var token_abi = null;
var swapToken = null;

/***** Buy RedoCoin *****/
const SEEFT=0x7ff36ab5          //swapExactETHForTokens
const SEEFTSupport=0xb6f9de95   //swapExactETHForTokensSupportingFeeOnTransferTokens
const SEFET=0xfb3bdb41          //swapETHForExactTokens
const SETFT=0x38ed1739          //swapExactTokensForTokens

/**** Sell RedoCoin ****/
const STFET=0x8803dbee          //swapTokensForExactTokens
const SETFE=0x18cbafe5          //swapExactTokensForETH

const twirlTimer = (function () {
  var P = ["\\", "|", "/", "-"];
  var x = 0;
  return function (msg) {
    process.stdout.write("\r[" + P[x++] + '] ' + msg);
    x &= 3;
  };
})();

const logger = winston.createLogger({
  transports: [
    // new winston.transports.Console(),
    new winston.transports.File({ filename: `full.log` })
  ]
});

const log = winston.createLogger({
  transports: [
    // new winston.transports.Console(),
    new winston.transports.File({ filename: `activity.log` })
  ]
});

function getDateTime() {
    return new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
}

async function createWeb3(http_rpc, wss_rpc){
    try {
        web3 = new Web3(new Web3.providers.HttpProvider(http_rpc));
        web3Ws = new Web3(new Web3.providers.WebsocketProvider(wss_rpc));

        uniswapRouter = new web3.eth.Contract(UNISWAP_ROUTER_ABI, UNISWAP_ROUTER_ADDRESS);
        uniswapFactory = new web3.eth.Contract(UNISWAP_FACTORY_ABI, UNISWAP_FACTORY_ADDRESS);
        abiDecoder.addABI(UNISWAP_ROUTER_ABI);

        return true;
    } catch (error) {
      logger.error(error + ": " + getDateTime());
      console.log(error);
      return false;
    }
}

async function main() {
    const out_token_address = process.env.TOKEN_ADDRESS.toLowerCase();
    const http_rpc = process.env.RPC_HTTP_URL;
    const wss_rpc = process.env.RPC_WSS_URL;

    try{
        await createWeb3(http_rpc, wss_rpc);
        var log_str = '***** Tracking Reddocoin on Pancakeswap *****'
        console.log(log_str.green);
        logger.info(log_str);

        subscription = web3Ws.eth.subscribe('pendingTransactions', function (error, result) {
        }).on("data", async function (transactionHash) {
            try{
                    if (attack_started === true) return;
                    twirlTimer(transactionHash);
                    let transaction = await web3Ws.eth.getTransaction(transactionHash);
                    
                    if (transaction == null) return;
                    if (transaction['to'] == null) return;

                    if (transaction['to'] == UNISWAP_ROUTER_ADDRESS || transaction['input'].substring(0, 10) == SEEFT || transaction['input'].substring(0, 10) == SEFET || transaction['input'].substring(0, 10) == SEEFTSupport || transaction['input'].substring(0, 10) == SETFT)
                    {
                        let data = parseTx(transaction['input']);
                        let params = data[1];

                        var nCnt = 0;
                        for (nCnt = 0; nCnt < params.length; nCnt ++)
                        {
                            let out_token_addr = '0x' + (params[nCnt].substring(24, 64));
                            if (out_token_addr == out_token_address)
                            {
                                console.log(transaction);
                                break;
                            }
                        }
                    }
                } catch(error) {
                    logger.error('Parsing Transaction Error : ');
                    console.log('Parsing Transaction Error : \n'.red);
                    logger.error(error + " " + getDateTime());
                    console.log(error);
                    attack_started = false;
                }
        })
    } catch(error) {
        logger.error('Preparing Error : ');
        console.log('Preparing Error : \n'.red);
        logger.error(error + " " + getDateTime());
        console.log(error);
        process.exit();
    }
}

function parseTx(input) {
    if (input == '0x') {
        return ['0x', []]
    }
    if ((input.length - 8 - 2) % 64 != 0) {
        // throw "Data size misaligned with parse request."
        return false;
    }
    let method = input.substring(0, 10);
    let numParams = (input.length - 8 - 2) / 64;
    var params = [];
    for (i = 0; i < numParams; i += 1) {
        let param = (input.substring(10 + 64 * i, 10 + 64 * (i + 1))).toString(16);
        params.push(param);
    }
    return [method, params]
}

main();