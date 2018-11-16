function assert(should_be_true, msg) {
	if(!should_be_true) throw(msg);
}

/** An inventory is used to model the specific items that are in stores.
 *
 *  An inventory can hold two kinds of keys:
 *
 *   - General Items
 *   - Assets, which implement the same interface as items, but are linked to a specific item stack in the EVE database
 */
class Inventory {
	constructor() {
		this.item_stacks = new Map();
	}
	
	find(key) {
		if(key instanceof Item)
			filter = x => {x == key || (x instanceof AssetItem && x.item == key)};
		else if(key instanceof ItemType)
			filter = x => {x.type == key};
		else
			filter = key;
		
		keys = this.item_stacks.filter(filter);
		return keys.map(x => {[x, this.item_stacks.get(x)]});
	}
	
	put(key, amount) {
		assert(key instanceof Item, "Inventory key must be Items");
		
		if this.item_stacks.has(key)
			this.item_stacks.set(key, this.item_stacks.get(key) + amount);
		else
			this.item_stacks.set(key, amount);
	}
	
	remove(key, amount) {
		remaining = amount;
		
		entries = this.find(key);
		total   = entries.reduce((x, y) => { x + y[1] }, 0);
		
		assert(total >= amount, "Insufficient amount of to-be-removed items in inventory");
		
		for entry of this.get_all(filter) {
			entry_key = entry[0];
			entry_amount = entry[1];
			
			to_remove = min(remaining, entry_amount);
			
			if to_remove == entry_amount
				this.item_stacks.delete(entry_key);
			else
				this.item_stacks.set(entry_key, entry_amount - to_remove);
		}
	}
	
	clone() {
		result = new Inventory();
		
		for entry of this.item_stacks.entries
			result.item_stacks.set(entry[0], entry[1]);
		
		return result;
	}
	
	clean() {
		old = [];
		this.item_stacks.forEach(
			(key, val, map) => {
				if(val == 0)
					old.push(key);
			}
		);
		old.forEach(key => { this.item_stacks.delete(key); });
	}
}

class Process {
	constructor(duration = 0, behaviors = []) {
		this.duration = duration;
		this.behaviors = behaviors;
	}
	
	start(inventory) {
		this.behaviors.forEach(child => { child.start(inventory); });
	}
	
	end(inventory) {
		this.behaviors.forEach(child => { child.end(inventory); });
	}
	
	consumes_items(type, amount) { this.behaviors.push(ConsumesItems(type, amount)); }
	produces_items(type, amount) { this.behaviors.push(ProducesItems(type, amount)); }
	damages_items(type, amount) { this.behaviors.push(DamagesItems(type, amount)); }
}

// --- Various process behaviors which are used in EVE's industry formulas

class ConsumesItems {
	constructor(type, amount) {
		this.type = type;
		this.amount = amount;
	}
	
	start(inventory) {
		inventory.remove(this.type, this.amount);
	}
	
	end(inventory, success) {}
	
	balance(chance) { return new Map([this.type, -this.amount]); }
}

class ProducesItems {
	constructor(item, amount) {
		this.item = item;
		this.amount = amount;
	}
	
	start(inventory) {}
	
	end(inventory, success) {
		if !success
			return;
		
		inventory.put(this.item, this.amount);
	}
	
	balance(chance) { return new Map([this.type, this.amount * chance]); }
}

class DamagesItems {
	constructor(type, amount) {
		this.type = type;
		this.amount = amount;
	}
	
	start(inventory) {
		entries = inventory.items.find(x => {x.type == this.type});
		total_health = entries.sum((partial, el) => { partial + el[0].health * el[1] }, 0);

		assert(total_health >= this.amount, "Insufficient inventory");
		
		damage_remaining = this.amount;
		
		while(damage_remaining > 0) {
			// See if there are still partially damaged items remaining
			entries = inventory.items.find(x => {x.type == this.type})	// Find all items / item stack entries
				.sort((a, b) => {a[0].health < b[0].health});			// Sort by damage (descending)
			
			assert(entries.length > 0, "Internal error");
			
			item  = entries[0];
			stock = entries[1];
			
			// Check if we need to remove multiples of items
			if damage_remaining >= item.health {
				// Do not modify the stack properties, but remove multiples of items
				to_remove = floor(damage_remaining / item.health);
				to_remove = min(to_remove, stock);
				
				inventory.remove(item, stock);
				damage_remaining -= to_remove * item.health;
			} else {
				// The damage is less than all items health
				// Remove one of the items from the stack and insert it with less remaining health
				inventory.remove(item, 1);
				
				new_item = item.clone();
				new_item.health = item.health - damage_remaining;
				
				// Put the damaged item on the stack
				inventory.put(new_item, 1);
			}
		}
	}
	
	end(inventory, success) {}
	
	balance(chance) { return new Map([this.type, -this.amount]); }
}

