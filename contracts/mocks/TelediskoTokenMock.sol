// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract TelediskoTokenMock {
    uint256 mockResult_balanceOfAt;

    function mock_balanceOfAt(uint256 mockResult) public {
        mockResult_balanceOfAt = mockResult;
    }

    function balanceOfAt(address, uint256) public view returns (uint256) {
        return mockResult_balanceOfAt;
    }

    function snapshot() public view returns (uint256) {}
}
