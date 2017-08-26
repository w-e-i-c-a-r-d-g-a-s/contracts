module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*", // Match any network id
      gasPrice: 0x05e4accdd9 // 25311366617 Gwei
    },
    coverage: {
      host: "localhost",
      port: 8545,
      network_id: "*",
      gas: 0xfffffffffff,
      gasPrice: 0x01
    }
  },
  mocha: {
    reporter: 'spec'
  }
};
