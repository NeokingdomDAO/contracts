// SPDX-License-Identifier: MIT

pragma solidity ^0.8.16;

contract Cooldown {
    struct CoolingTokens {
        uint256 amount;
        uint256 coolingEndTimestamp;
    }

    mapping(address => CoolingTokens[]) coolingTokens;

    uint256 coolingPeriod;
}
