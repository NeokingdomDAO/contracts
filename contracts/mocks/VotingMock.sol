// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract VotingMock {
    event AfterTokenTransferCalled(address from, address to, uint256 amount);
    event AfterAddContributor(address account);
    event BeforeRemoveContributor(address account);

    function afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) external {
        emit AfterTokenTransferCalled(from, to, amount);
    }

    function beforeRemoveContributor(address account) external {
        emit BeforeRemoveContributor(account);
    }

    function afterAddContributor(address account) external {
        emit AfterAddContributor(account);
    }

    mapping(address => address) mockResult_getDelegateAt;
    mapping(address => uint256) mockResult_getVotingPowerAt;
    mapping(address => bool) mockResult_canVoteAt;

    uint256 mockResult_getTotalVotingPowerAt;

    function mock_getDelegateAt(address account, address mockResult) public {
        mockResult_getDelegateAt[account] = mockResult;
    }

    function mock_getVotingPowerAt(address account, uint256 mockResult) public {
        mockResult_getVotingPowerAt[account] = mockResult;
    }

    function mock_getTotalVotingPowerAt(uint256 mockResult) public {
        mockResult_getTotalVotingPowerAt = mockResult;
    }

    function mock_canVoteAt(address account, bool mockResult) public {
        mockResult_canVoteAt[account] = mockResult;
    }

    function getDelegateAt(address account, uint256)
        public
        view
        returns (address)
    {
        return mockResult_getDelegateAt[account];
    }

    function canVoteAt(address account, uint256) public view returns (bool) {
        return mockResult_canVoteAt[account];
    }

    function getVotingPowerAt(address account, uint256)
        public
        view
        returns (uint256)
    {
        return mockResult_getVotingPowerAt[account];
    }

    function getTotalVotingPowerAt(uint256) public view returns (uint256) {
        return mockResult_getTotalVotingPowerAt;
    }

    function snapshot() public view returns (uint256) {}
}
