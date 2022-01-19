// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IDelegation {
    function snapshot() external returns (uint);
    
    function getDelegatedAt(address, uint256) external returns (address);
    function getDelegatorsAt(address, uint256) external returns (address[] memory);
    function getVotingPowerAt(address, uint256) external returns (uint256);

    function getDelegated(address) external returns (address);
    function getDelegators(address) external returns (address[] memory);
    function getVotingPower(address) external returns (uint256);

    function delegate(address delegated) external;
}

contract Delegation is IDelegation {
    mapping(address=>address) public delegateTo;
    mapping(address=>address[]) public delegateFrom;


    function snapshot() external returns (uint) {

    }
    
    function getDelegatedAt(address, uint256) external returns (address) {

    }

    function getDelegatorsAt(address, uint256) external returns (address[] memory) {

    }
    
    function getVotingPowerAt(address, uint256) external returns (uint256) {

    }

    function getDelegated(address) external returns (address) {

    }

    function getDelegators(address) external returns (address[] memory) {

    }

    function getVotingPower(address) external returns (uint256) {

    }

    function delegate(address delegated) external {
        delegateTo[msg.sender] = delegated;
        delegateFrom[delegated].push(msg.sender);
    }
}
