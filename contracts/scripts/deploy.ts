
import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();

  const CM = await ethers.getContractFactory("CourseManager");
  const cm = await CM.deploy('0xFf0E73Ffa88536dBcE4416A8f68bF3c0997AA076');
  await cm.waitForDeployment();

  const addresses = {
    CourseManager: await cm.getAddress()
  };
  const out = path.join(process.cwd(), "deployments.local.json");
  fs.writeFileSync(out, JSON.stringify(addresses, null, 2));
  console.log("Deployed:", addresses);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
