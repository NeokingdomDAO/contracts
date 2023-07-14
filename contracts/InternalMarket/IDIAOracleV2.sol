// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

interface IDIAOracleV2 {
    function setValue(
        string memory key,
        uint128 value,
        uint128 timestamp
    ) external;

    function getValue(
        string memory key
    ) external view returns (uint128 value, uint128 timestamp);

    function updateOracleUpdaterAddress(
        address newOracleUpdaterAddress
    ) external;
}
