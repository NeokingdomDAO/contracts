// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract SnapshottableMock {
    uint256 mockId = 1;

    function snapshot() public returns (uint256) {
        return mockId++;
    }
}
