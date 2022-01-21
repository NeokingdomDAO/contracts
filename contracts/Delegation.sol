// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Delegation {
  mapping(address => address) _delegates;
  mapping(address => address[]) _delegators;

  function delegate(address delegated) external {
    require(
      getDelegated(delegated) == delegated || delegated == msg.sender,
      "Delegation: the proposed delegate already has a delegate."
    );
    require(
      _delegators[msg.sender].length == 0,
      "Delegation: you already have delegators."
    );

    address oldDelegated = getDelegated(msg.sender);
    require(
      oldDelegated != delegated,
      "Delegation: the proposed delegate is already your delegate."
    );

    _beforeDelegate(delegated);

    _removeDelegator(oldDelegated, msg.sender);

    if (delegated != msg.sender) {
      _delegates[msg.sender] = delegated;
      _delegators[delegated].push(msg.sender);
    } else {
      _delegates[msg.sender] = address(0);
    }
  }

  function getDelegated(address account) public view returns (address) {
    address delegated = _delegates[account];
    return delegated == address(0) ? account : delegated;
  }

  function getDelegators(address account)
    public
    view
    returns (address[] memory)
  {
    return _delegators[account];
  }

  function _removeDelegator(address account, address toRemove) internal {
    address[] memory oldDelegatorList = _delegators[account];
    delete _delegators[account];
    for (uint256 i = 0; i < oldDelegatorList.length; i++) {
      if (oldDelegatorList[i] != toRemove) {
        _delegators[account].push(oldDelegatorList[i]);
      }
    }
  }

  function _beforeDelegate(address delegated) internal virtual {}
}
