import { ethers } from 'ethers';
import ERC20ABI from './ABI/ERC20.abi.json';
import 'dotenv/config';

if (!process.env.RPC_URL_MAINNET) {
  throw new Error('ENV RPC_URL_MAINNET is not set');
}

export const provider = new ethers.providers.StaticJsonRpcProvider(
  process.env.RPC_URL_MAINNET,
);

export const ERC20Interface = new ethers.utils.Interface(ERC20ABI);
export const TRANSFER_EVENT_TOPIC = ERC20Interface.getEventTopic('Transfer');
export const APPROVAL_EVENT_TOPIC = ERC20Interface.getEventTopic('Approval');

const debugLabels = {
  '0x5f259d0b76665c337c6104145894f4d1d2758b8c': 'AttackDeployer',
  '0xebc29199c817dc47ba12e3f86102564d640cbf99': 'AttackerContract',
  '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9': 'AaveLendingPoolProxy',
  '0x028171bca77440897b824ca71d1c56cac55b68a3': 'aDAIProxy',
  '0x7b2a3cf972c3193f26cdec6217d27379b6417bd0': 'aDAIImpl',
  '0x6b175474e89094c44da98b954eedeac495271d0f': 'DAI',
  '0x583c21631c48d442b5c0e605d624f54a0b366c72': 'Violator',
  '0xa0b3ee897f233f385e5d61086c32685257d4f12b': 'Liquidator',
  '0x27182842e098f60e3d576794a5bffb0777e025d3': 'EulerProtocol',
  '0xbb0d4bb654a21054af95456a3b29c63e8d1f4c0a': 'eDAI',
  '0xe025e3ca2be02316033184551d4d3aa22024d9dc': 'eDAIRouter',
  '0x3297c8db9360f87a7f7826f52a4fa143988931a6': 'RiskManager',
  '0x6085bc95f506c326dcbcd7a6dd6c79fbc18d4686': 'dDAIRouter',
  '0x29daddfda3442693c21a50351a2b4820ddbbff79': 'dDAI',
  '0xd737ee2bb39f49c62a436002a77f2710cc45ed98': 'LiquidationContract',
  '0xc6845a5c768bf8d7681249f8927877efda425baf': 'AaveLendingPoolImpl',
  // test
  '0x498c5431EB517101582988fBb36431DdaaC8F4B1': 'Borrower',
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'WETH',
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 'WBTC',
  // Tx 0x62bd3d31a7b75c098ccf28bc4d4af8c4a191b4b9e451fab4232258079e8b18c4
  '0xb2698c2d99ad2c302a95a8db26b08d17a77cedd4': 'AttackerDeployer',
  '0x036cec1a199234fc02f72d29e596a09440825f1c': 'AttackerContract',
  '0x84273bba41cd0ec99f59b5b4c85783cf514e4e1a': 'Violator',
  '0x22c5cf8fc9891f8ef5a5e8630b95115018a09736': 'Liquidator',
  '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0': 'WstETH',
  '0xba12222222228d8ba445958a75a0704d566bf2c8': 'BalancerVault',
};
export const getLabel = (key: string): string => {
  return debugLabels[key.toLowerCase()] || key;
};
