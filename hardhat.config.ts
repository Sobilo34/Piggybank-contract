
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";
dotenv.config();

const LISK_URL_RPC = process.env.LISK_URL_RPC;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const LISK_EXPLORER_KEY = process.env.LISK_EXPLORER_KEY || (() => { throw new Error("LISK_EXPLORER_KEY is not defined"); })();

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    lisk: {
      url: LISK_URL_RPC,
      accounts: [PRIVATE_KEY ? (PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`) : (() => { throw new Error("PRIVATE_KEY is not defined"); })()]
    },
  },
  etherscan: {
    apiKey: {
      lisk: LISK_EXPLORER_KEY
    },
    customChains: [
      {
        network: "lisk",
        chainId: 4202,
        urls: {
          apiURL: "https://sepolia-blockscout.lisk.com/api",
          browserURL: "https://sepolia-blockscout.lisk.com"
        }
      }
    ]
  },
};

export default config;