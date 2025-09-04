
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

import dotenv from "dotenv";

dotenv.config();

const SEPOLIA_RPC = process.env.SEPOLIA_RPC || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  networks: {
    hardhat: {},
    localhost: { url: "http://127.0.0.1:8545" },
        sepolia: {
          url: SEPOLIA_RPC,
          accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
        },
  }
};

export default config;
