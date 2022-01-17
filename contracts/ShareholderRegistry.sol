// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Snapshot.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// TODO: consider using this
// import "@openzeppelin/contracts/access/AccessControl.sol";

abstract contract Shareholder is ERC20Snapshot {
    // I as a founder* can transfer a share to a wallet and the wallet becomes an Investor
    // I as a founder* can elect a shareholder to either contributor or investor
    // I as a founder* can deactivate a shareholder share, hence their TT tokens for voting (after resolution) -> it's sufficient to set the role to ANON
    // *to replace with "I as a Resolution contract" as soon as the founder gives away the responsability

    // I as a shareholder can transfer shares only through Resolution contract
    // I as a shareholder can have up to 1 share
    // I as a contributor-shareholder can use my TT to vote resolutions
    // I as an investor-shareholder cannot use my TT to vote resolutions

    // Anon avoids being FOUNDER if not present in the `roles` mapping.

    // Benjamin takes all the decisions in first months, assuming the role of
    // the "Resolution", to then delegate to the resolution contract what comes
    // next.
    // This is what zodiac calls "incremental decentralization".

    address RESOLUTION_ADDRESS = address(0);

    // Role should be snapshotted too
    enum Role {
        ANON,
        FOUNDER,
        INVESTOR,
        CONTRIBUTOR
    }

    mapping(address => Role) roles;

    modifier onlyFounder() {
        _;
    }

    // ACL
    function isFounder(address a) public view returns (bool) {
        return isFounderAt(a, 666);
    }

    function isInvestor(address a) public view returns (bool) {
        return isFounderAt(a, 666);
    }

    function isContributor(address a) public view returns (bool) {
        return isContributorAt(a, 666);
    }

    function isShareholder(address a) public view returns (bool) {
        return isShareholderAt(a, 666);
    }

    function isResolution(address a) public view returns (bool) {
        return isResolutionAt(a, 666);
    }

    function isFounderAt(address a, uint256 snapshotId)
        public
        view
        returns (bool)
    {
        return roles[a] == Role.FOUNDER;
    }

    function isInvestorAt(address a, uint256 snapshotId)
        public
        view
        returns (bool)
    {
        return roles[a] == Role.INVESTOR;
    }

    function isContributorAt(address a, uint256 snapshotId)
        public
        view
        returns (bool)
    {
        return roles[a] == Role.CONTRIBUTOR;
    }

    function isShareholderAt(address a, uint256 snapshotId)
        public
        view
        returns (bool)
    {
        return balanceOf(a) > 0;
    }

    function isResolutionAt(address a, uint256 snapshotId)
        public
        view
        returns (bool)
    {
        return a == RESOLUTION_ADDRESS;
    }

    // Admin
    function setRole(address a, Role r) public {
        require(
            isResolution(a),
            "Shareholder: only resolutions can changes roles"
        );
        require(isShareholder(a), "Shareholder: address is not shareholder");
        roles[a] = r;
    }

    function _beforeTokenTransfer(
        address,
        address to,
        uint256
    ) internal view override {
        require(
            isResolution(_msgSender()), // 2.7
            "ShareholderRegistry: only resolution can transfer shares"
        );

        require(
            isFounder(to) || !isShareholder(to), // 2.8
            "ShareholderRegistry: more than one share assigned to shareholder"
        );
    }

    function _afterTokenTransfer(
        address,
        address to,
        uint256
    ) internal override {
        setRole(to, Role.INVESTOR);
    }
}
