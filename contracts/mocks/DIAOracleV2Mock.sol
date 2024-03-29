/**
 *Submitted for verification at escan.live on 2023-06-20
 */

// compiled using solidity 0.7.4

pragma solidity ^0.8.16;

contract DIAOracleV2Mock {
    mapping(string => uint256) public values;
    address oracleUpdater;

    event OracleUpdate(string key, uint128 value, uint128 timestamp);
    event UpdaterAddressChange(address newUpdater);

    constructor() {
        oracleUpdater = msg.sender;
        setValue("USDC/USD", 100056862, 1688997110);
        setValue("EUR/USD", 109479913, 1688997110);
    }

    function setValue(
        string memory key,
        uint128 value,
        uint128 timestamp
    ) public {
        require(msg.sender == oracleUpdater);
        uint256 cValue = (((uint256)(value)) << 128) + timestamp;
        values[key] = cValue;
        emit OracleUpdate(key, value, timestamp);
    }

    function getValue(
        string memory key
    ) external view returns (uint128, uint128) {
        uint256 cValue = values[key];
        uint128 timestamp = (uint128)(cValue % 2 ** 128);
        uint128 value = (uint128)(cValue >> 128);
        return (value, timestamp);
    }

    function updateOracleUpdaterAddress(
        address newOracleUpdaterAddress
    ) public {
        require(msg.sender == oracleUpdater);
        oracleUpdater = newOracleUpdaterAddress;
        emit UpdaterAddressChange(newOracleUpdaterAddress);
    }
}
