import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const PiggyFactoryModule = buildModule("PiggyFactoryModule", (m) => {
  const piggyFactory = m.contract("PiggyFactory");

  return { piggyFactory };
});

export default PiggyFactoryModule;
