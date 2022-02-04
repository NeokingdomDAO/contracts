// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract VotingMock {
    event AfterTokenTransferCalled(address from, address to, uint256 amount);

    function afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) external {
        emit AfterTokenTransferCalled(from, to, amount);
    }

    address mockResult_getDelegateAt;
    uint256 mockResult_getVotingPowerAt;
    uint256 mockResult_getTotalVotingPowerAt;

    function mock_getDelegateAt(address mockResult) public {
        mockResult_getDelegateAt = mockResult;
    }

    function mock_getVotingPowerAt(uint256 mockResult) public {
        mockResult_getVotingPowerAt = mockResult;
    }

    function mock_getTotalVotingPowerAt(uint256 mockResult) public {
        mockResult_getTotalVotingPowerAt = mockResult;
    }

    function getDelegateAt(address, uint256) public view returns (address) {
        return mockResult_getDelegateAt;
    }

    function getVotingPowerAt(address, uint256) public view returns (uint256) {
        return mockResult_getVotingPowerAt;
    }

    function getTotalVotingPowerAt(uint256) public view returns (uint256) {
        return mockResult_getTotalVotingPowerAt;
    }

    function snapshot() public view returns (uint256) {}
}
