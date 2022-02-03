// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../Voting/IVoting.sol";
import "../ShareholderRegistry/IShareholderRegistry.sol";

contract TelediskoTokenBase is ERC20 {
    IVoting _voting;
    IShareholderRegistry _shareholderRegistry;

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function setVoting(IVoting voting) external virtual {
        _setVoting(voting);
    }

    function setShareholderRegistry(IShareholderRegistry shareholderRegistry)
        external
        virtual
    {
        _setShareholderRegistry(shareholderRegistry);
    }

    function mint(address to, uint256 amount) public virtual {
        _mint(to, amount);
    }

    function _setVoting(IVoting voting) internal {
        _voting = voting;
    }

    function _setShareholderRegistry(IShareholderRegistry shareholderRegistry)
        internal
    {
        _shareholderRegistry = shareholderRegistry;
    }

    // TODO: the logic to decide whether an account can transfer tokens or not depends on multiple components
    // that have yet to be implemented. This is only a first draft.
    /*
    function _canTransfer(address account) internal returns (bool) {
        // This check may potentially burn quite some gas
        return
            _shareholderRegistry.getStatus(account) !=
            _shareholderRegistry.CONTRIBUTOR_STATUS();
    }
    */

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        /*
        require(
            _canTransfer(from),
            "TelediskoToken: contributors cannot transfer shares before previous approval."
        );
        */
        return super._transfer(from, to, amount);
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        _voting.afterTokenTransfer(from, to, amount);
    }
}
