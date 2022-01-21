// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IDelegation.sol";

contract Delegation {
    mapping(address => address) _delegates;
    mapping(address => address[]) _delegators;
    

    function _beforeDelegate(address delegated) internal virtual {

    }

    function delegate(address delegated) external {
        _beforeDelegate(delegated);
        address oldDelegated = _delegates[msg.sender];
        _removeDelegator(_delegators[oldDelegated], msg.sender); 
        _delegates[msg.sender] = delegated;
        _delegators[delegated].push(msg.sender);
    }


    function getDelegated(address account) external view returns (address) {
        return _delegates[account];
    }

    function getDelegators(address account) external view returns (address[] memory) {
        return _delegators[account];
    }

    function _removeDelegator(address[] storage delegators, address toRemove) internal {
        // TODO
    }
}
