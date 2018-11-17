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
		this.contents = [];
	}
	
	key_to_filter(key) {
		var filter;
		
		if(key instanceof Item)
			filter = x => {x.key.equals(key)};
		else if(key instanceof ItemType)
			filter = x => {x.type.equals(key)};
		else
			filter = x => {key(x.key)};
		
		return filter;
	}
	
	find(key) {
		return this.contents.filter(this.key_to_filter(key));
	}
	
	put(key, amount) {
		var index = this.contents.findIndex(this.key_to_filter(key));
		
		if index != -1
			this.contents[index].amount += 1;
		else {
			assert(key instanceof Item, "To insert element without matching stack, key must be of type 'Item'");
			this.contents.push({key: key, value: 1});
		}
		
		this.sort();
	}
	
	remove(key, amount) {
		var remaining = amount;
		
		var filter = key_to_filter(key);
		
		var entries = this.find(filter);
		var total   = entries.reduce((x, y) => { x + y[1] }, 0);
		
		assert(total >= amount, "Insufficient amount of to-be-removed items in inventory");
		
		while remaining > 0 {
			var index = this.contents.findIndex(filter);
			assert(index != -1, "Internal error: No elements left even though count indicated otherwise");
			var entry = this.contents[index];
			
			to_remove = min(remaining, entry.value);
			remaining -= to_remove;
			
			if to_remove == entry.value
				// Remove entry
				this.contents = this.contents.slice(0, index).concat(this.contents.slice(index + 1));
			else
				// Adjust entry
				this.contents[index].value -= to_remove;
		}
		
		this.sort();
	}
	
	clone() {
		result = new Inventory();
		
		result.contents = contents.slice();
		
		return result;
	}
	
	sort() {
		function entry_comparator(x, y) {
			if(!x.key.equals(y.key))
				return x.key.comparator;
			
			return x.value < y.value;
		}
		
		this.contents.sort(entry_comparator);
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

