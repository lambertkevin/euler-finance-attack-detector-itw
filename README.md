# Nefture Interview

## Installation

To install the necessary dependencies, run the following command:

```bash
npm install
```

## Starting the Application

Create a .env file with an archive RPC node for Ethereum mainnet:

```bash
RPC_URL_MAINNET=https://ethereum.blockpi.network/v1/rpc/api_key
```

To start the application, use the following command:

```bash
npm start
```

## Usage

### Analyze Block

To analyze a block, send a POST request to `/analyze-block` with a `blockNumber` body parameter.

**Example Request:**

```bash
curl -X POST http://localhost:3000/analyze-block \
  -H "Content-Type: application/json" \
  -d '{ "blockNumber": 16818057 }'
```

### Analyze Transaction

To analyze a transaction, send a POST request to `/analyze-transaction` with a `txHash` body parameter.

**Example Request:**

```bash
curl -X POST http://localhost:3000/analyze-transaction \
  -H "Content-Type: application/json" \
  -d '{ "txHash": "0xc310a0affe2169d1f6feec1c63dbc7f7c62a887fa48795d327d4d2da2d6b111d" }'
```


**Expectations:**
```bash
$ curl -X POST http://localhost:3000/analyze-transaction \
  -H "Content-Type: application/json" \
  -d '{ "txHash": "0xc310a0affe2169d1f6feec1c63dbc7f7c62a887fa48795d327d4d2da2d6b111d" }' | jq .

{
  "blockNumber": 16817996,
  "isFlashLoan": true,
  "anaylisis": {
    "selfLiquidation": true,
    "attacker": "0x583c21631c48d442b5c0e605d624f54a0b366c72",
    "victims": [
      {
        "account": "0x27182842e098f60e3d576794a5bffb0777e025d3",
        "diff": "-8904507.348306697267428294",
        "token": "Dai Stablecoin"
      }
    ]
  }
}

$ curl -X POST http://localhost:3000/analyze-transaction \
  -H "Content-Type: application/json" \
  -d '{ "txHash": "0x71a908be0bef6174bccc3d493becdfd28395d78898e355d451cb52f7bac38617" }' | jq .

{
  "blockNumber": 16818057,
  "isFlashLoan": true,
  "anaylisis": {
    "selfLiquidation": true,
    "attacker": "0xb324581ee258aa67bc144ad27f79f8dcac569af0",
    "victims": [
      {
        "account": "0x27182842e098f60e3d576794a5bffb0777e025d3",
        "diff": "-849.13597139",
        "token": "Wrapped BTC"
      }
    ]
  }
}
$ curl -X POST http://localhost:3000/analyze-transaction \
  -H "Content-Type: application/json" \
  -d '{ "txHash": "0x62bd3d31a7b75c098ccf28bc4d4af8c4a191b4b9e451fab4232258079e8b18c4" }' | jq .

{
  "blockNumber": 16818062,
  "isFlashLoan": true,
  "anaylisis": {
    "selfLiquidation": true,
    "attacker": "0x1e4446016f3fddfe2ecc046cf91a8010a30e9a9b",
    "victims": [
      {
        "account": "0x27182842e098f60e3d576794a5bffb0777e025d3",
        "diff": "-66271.498175683316786271",
        "token": "Wrapped liquid staked Ether 2.0"
      }
    ]
  }
}

$ curl -X POST http://localhost:3000/analyze-transaction \
  -H "Content-Type: application/json" \
  -d '{ "txHash": "0x465a6780145f1efe3ab52f94c006065575712d2003d83d85481f3d110ed131d9" }' | jq .

{
  "blockNumber": 16818065,
  "isFlashLoan": true,
  "anaylisis": {
    "selfLiquidation": true,
    "attacker": "0x7db7099b00d1d24ef2814cfcde723eacd958b05b",
    "victims": [
      {
        "account": "0x27182842e098f60e3d576794a5bffb0777e025d3",
        "diff": "-34413863.41846",
        "token": "USD Coin"
      }
    ]
  }
}

$ curl -X POST http://localhost:3000/analyze-transaction \
  -H "Content-Type: application/json" \
  -d '{ "txHash": "0x3097830e9921e4063d334acb82f6a79374f76f0b1a8f857e89b89bc58df1f311" }' | jq .

{
  "blockNumber": 16818085,
  "isFlashLoan": true,
  "anaylisis": {
    "selfLiquidation": true,
    "attacker": "0xa4c0afeca6273b012382970c1ed8690c2929988d",
    "victims": [
      {
        "account": "0x27182842e098f60e3d576794a5bffb0777e025d3",
        "diff": "-3897.504357548022052969",
        "token": "Liquid staked Ether 2.0"
      }
    ]
  }
}

$ curl -X POST http://localhost:3000/analyze-transaction \
  -H "Content-Type: application/json" \
  -d '{ "txHash": "0x47ac3527d02e6b9631c77fad1cdee7bfa77a8a7bfd4880dccbda5146ace4088f" }' | jq .

{
  "blockNumber": 16818024,
  "isFlashLoan": true,
  "anaylisis": {
    "selfLiquidation": true,
    "attacker": "0x0b812c74729b6abc723f22986c61d95344ff7aba",
    "victims": [
      {
        "account": "0x27182842e098f60e3d576794a5bffb0777e025d3",
        "diff": "-8099.303891868396965958",
        "token": "Wrapped Ether"
      }
    ]
  }
}
```