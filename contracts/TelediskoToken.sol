// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Snapshot.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract TelediskoToken is ERC20Snapshot {
    uint256 public totalVotingTokens;
    uint256 constant OFFER_DURATION = 2 weeks; 
    address constant DAI_ADDRESS = 0x1111111111111111111111111111111111111111;

    //mapping(address => mapping(uint256 => uint256)) offers;
    mapping(address => uint256) offered;

    mapping(address => Offer[]) offers;

    mapping(address=>uint) allowance;

    struct Offer {
        uint ts;
        uint amount;
    }

    function isContributor(address a) internal view returns (bool) {
        
    }

    modifier onlyContributor() {
        require(isContributor(_msgSender()), "TT: not a contributor");
        _;
    }

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address, uint256) public {}

    function offer(uint amount) public onlyContributor {
        require(balanceOf(_msgSender()) - offered[_msgSender()] >= amount, "TT: not enough balance");
        // Create offer
        offered[_msgSender()] += amount;
        // offers[_msgSender()][block.timestamp] = amount;
        // Add offers to various mappings
    }


    function buy(address from, uint id, uint amount) public onlyContributor payable {
        // Contributor needs to call `approve` on the DAI contract
        IERC20 dai = IERC20(DAI_ADDRESS);
        Offer memory o = offers[from][id];
        dai.transferFrom(_msgSender(), from, amount);
        // remove offer from array
        _transfer(from, _msgSender(), amount);
    }

    function updateAllowance(address contributor) public view returns (uint){
        uint total;
        Offer[] storage contributorOffers = offers[contributor];
        for(uint i=0; i<contributorOffers.length; i++){
            Offer memory o = contributorOffers[i];
            if (block.timestamp >= o.ts + OFFER_DURATION){
                total += o.amount;
            }
            // Remove offer from array
        }
        allowance[contributor] += total;
    }

    function _beforeTokenTransfer(
        address from,
        address,
        uint256 amount
    ) internal view override {
        if(isContributor(_msgSender())){
            updateAllowance(_msgSender());
        }
        require(!isContributor(_msgSender()) || allowance[from] <= amount, "TelediskoToken: not enough allowance");
    }

    function _afterTokenTransfer(
        address from,
        address,
        uint256 amount
    ) internal view override {
        if(isContributor(_msgSender())){
            allowance[from] -= amount;
            offered[_msgSender()] -= amount;
        }
    }
}
