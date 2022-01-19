// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Snapshot.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// TODO: consider using this
import "@openzeppelin/contracts/access/AccessControl.sol";

contract ShareholderRegistry is ERC20Snapshot, AccessControl {
    // I as a founder* can transfer a share to a wallet and the wallet becomes an Investor
    // I as a founder* can elect a shareholder to either contributor or investor
    // I as a founder* can deactivate a shareholder share, hence their TT tokens for voting (after resolution) -> it's sufficient to set the role to ANON
    // *to replace with "I as a Resolution contract" as soon as the founder gives away the responsability

    // I as a shareholder can transfer shares only through Resolution contract
    // I as a shareholder can have up to 1 share
    // I as a contributor-shareholder can use my TT to vote resolutions
    // I as an investor-shareholder cannot use my TT to vote resolutions

    // Anon avoids being FOUNDER if not present in the `statuses` mapping.

    // Benjamin takes all the decisions in first months, assuming the role of
    // the "Resolution", to then delegate to the resolution contract what comes
    // next.
    // This is what zodiac calls "incremental decentralization".
    bytes32 public MANAGER_ROLE = keccak256("MANAGER_ROLE");

    // Role should be snapshotted too
    enum Status {
        INVESTOR,
        FOUNDER,
        CONTRIBUTOR
    }

    event StatusChanged(address indexed account);

    mapping(address => Status) statuses;

    constructor() ERC20("TelediskoToken", "TT") {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function mint(address account, uint256 amount) public onlyRole(MANAGER_ROLE) {
        _mint(account, amount);
    }

    // ACL
    function isFounder(address a) public view returns (bool) {
        return isFounderAt(a, 666);
    }

    function isInvestor(address a) public view returns (bool) {
        return isInvestorAt(a, 666);
    }

    function isContributor(address a) public view returns (bool) {
        return isContributorAt(a, 666);
    }

    function isShareholder(address a) public view returns (bool) {
        return isShareholderAt(a, 666);
    }

    function isFounderAt(address a, uint256 snapshotId)
        public
        view
        returns (bool)
    {
        return isShareholderAt(a, snapshotId) && statuses[a] == Status.FOUNDER;
    }

    function isInvestorAt(address a, uint256 snapshotId)
        public
        view
        returns (bool)
    {
        return isShareholderAt(a, snapshotId);
    }

    function isContributorAt(address a, uint256 snapshotId)
        public
        view
        returns (bool)
    {
        return isShareholderAt(a, snapshotId) && statuses[a] == Status.CONTRIBUTOR;
    }

    function isShareholderAt(address a, uint256 snapshotId)
        public
        view
        returns (bool)
    {
        return balanceOf(a) > 0;
    }

    // Admin
    function setStatus(Status r, address a) public onlyRole(MANAGER_ROLE) {
        require(isShareholder(a), "Shareholder: address is not shareholder");
        statuses[a] = r;
    }

    function transfer(address recipient, uint256 amount)
        public
        override
        onlyRole(MANAGER_ROLE)
        returns (bool)
    {
        return super.transfer(recipient, amount);
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public override onlyRole(MANAGER_ROLE) returns (bool) {
        return super.transferFrom(sender, recipient, amount);
    }

    function _beforeTokenTransfer(
        address,
        address to,
        uint256
    ) internal view override {
        require(
            isFounder(to) || !isShareholder(to), // 2.8
            "ShareholderRegistry: more than one share assigned to shareholder"
        );
    }
}
