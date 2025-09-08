import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const PiggyFactoryModule = buildModule("PiggyFactoryModule", (m) => {
  const piggyFactory = m.contract("PiggyFactory");

  const userAddress = m.getParameter("Sobil", "0xf070F568c125b2740391136662Fc600A2A29D2A6");

  // After deploying, run createPiggyBank as admin
  m.call(piggyFactory, "createPiggyBank", [userAddress]);

  return { piggyFactory };
});

export default PiggyFactoryModule;
