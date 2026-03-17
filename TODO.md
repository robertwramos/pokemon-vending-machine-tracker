# Todo

1. **Implement functionality for adding missed restocks and determine best UX for this**
   - Can implement as a slash command that takes the machine ID, Date, and Time as arguments
   - We can spawn a modal when the user presses 'Restocked' that provides a date text field and a time text field that are both optional and we use the current time if both of those fields are blank

2. **Create algorithm for determining possible refresh window**
   - Display possible refresh window on machine message
   - Run algorithm after check ins
   - Display confidence of prediction on message
   - Degrade confidence with recent restocks

3. **Create vending machine analytics to get a better understanding of how and when vending machines decide to drop product to help users determine the best times to check vending machines**
