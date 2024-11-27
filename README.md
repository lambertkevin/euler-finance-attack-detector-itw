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