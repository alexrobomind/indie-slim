class Inventory {
	constructor() {
		// Map ItemType -> Integer of stacked items
		this.item_stacks = new Map();
		this.items = [];
	}
	
	clone() {
		result = new Inventory();
		
		this.item_stacks.for_each((key, val, map) => { result.item_stacks.put(key, val); });
		this.items.for_each(item => { result.items.push(item.clone()); });
		
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

function assert(should_be_true, msg) {
	if(!should_be_true) throw(msg);
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
	produces_item(template) { this.behaviors.push(ProducesItem(template)); }
	damages_items(type, amount) { this.behaviors.push(DamagesItems(type, amount)); }
}

// --- Various process behaviors which are used in EVE's industry formulas

class ConsumesItems {
	constructor(type, amount) {
		this.type = type;
		this.amount = amount;
	}
	
	start(inventory) {
		count = inventory.item_stacks.get(this.type);
		assert(count !== undefined, "No items in inventory");
		assert(count >= amount, "Insufficient amount in inventory");
		inventory.item_stacks.put(this.type, count - this.amount);
	}
	
	end(inventory, success) {}
	
	balance(chance) { return new Map([this.type, -this.amount]); }
}

class ProducesItems {
	constructor(type, amount) {
		this.type = type;
		this.amount = amount;
	}
	
	start(inventory) {}
	
	end(inventory, success) {
		if !success
			return;
		
		count = inventory.item_stacks.get(this.type);
		
		if count === undefined
			count = 0;
		
		inventory.item_stacks.put(this.type, count + this.amount);
	}
	
	balance(chance) { return new Map([this.type, this.amount * chance]); }
}

class ProducesItem {
	constructor(item) {
		this.item = item;
	}
	
	start(inventory) {}
	
	end(inventory, success) {
		if !success
			return;
		
		inventory.items.push(item.clone());
	}
	
	balance(chance) { return new Map([this.item.type, chance]); }
}

class DamagesItems {
	constructor(type, amount) {
		this.type = type;
		this.amount = amount;
	}
	
	start(inventory) {
		amount_remaining = this.amount;
		
		while(amount_remaining > 0) {
			// See if there are still partially damaged items remaining
			items = inventory.items.filter(x => {x.type == this.type}).sort((a, b) => {a.damage > b.damage});
			
			if items.length > 0 {
				// Consume the item with the highest amount of damage first
				item = items[0];
				
				possibleDamage = min(1 - item.damage, amount_remaining);
				
				amount_remaining -= possibleDamage;
				item.damage += possibleDamage;
				
				if item.damage >= 1
					inventory.items = inventory.items.filter(x => { x !== item });
			} else {
				take_out = ceil(amount_remaining);
				
				stack_amount = inventory.item_stacks.get(this.type);
				
				assert(stack_amount !== undefined, "No inventory");
				assert(stack_amount >= take_out, "Insufficient inventory");
				
				inventory.item_stacks.put(this.type, stack_amount - take_out);
				
				for(i = 0; i < stack_amount; ++i)
					inventory.items.push(this.type.create_item());
			}
		}
	}
}

