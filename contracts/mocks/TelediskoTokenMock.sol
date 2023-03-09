// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract NeokingdomTokenMock {
    mapping(address => uint256) mockResult_balanceOfAt;

    function mock_balanceOfAt(address account, uint256 mockResult) public {
        mockResult_balanceOfAt[account] = mockResult;
    }

    function balanceOfAt(address account, uint256)
        public
        view
        returns (uint256)
    {
        return mockResult_balanceOfAt[account];
    }

    function snapshot() public view returns (uint256) {}
}
