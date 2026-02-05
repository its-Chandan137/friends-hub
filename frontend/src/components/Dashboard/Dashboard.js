import React, { useState, useEffect } from 'react';
import { getSocket } from '../../socket'; // adjust path if needed
import './Dashboard.scss';

function Dashboard({ user }) {
  const [meals, setMeals] = useState([]);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    // Request current meals on mount
    socket.emit('getMeals');

    socket.on('mealsData', (data) => {
      console.log('Received meals:', data);
      // Ensure every item has _id as string
      const normalized = data.map(item => ({
        ...item,
        _id: item._id || item.itemId || '',  // fallback
      }));
      setMeals(normalized);
    });

    socket.on('rowUpdate', (update) => {
      setMeals((prev) =>
        prev.map((item) => {
          const currentId = item._id || item.itemId;
          const updateId = update._id || update.itemId;
          if (currentId === updateId) {
            return { ...item, ...update, _id: update._id || currentId };
          }
          return item;
        })
      );
    });

    socket.on('newMealCreated', (newMeal) => {
      const normalizedNew = {
        ...newMeal,
        _id: newMeal._id || newMeal.itemId || '',
      };
      console.log('New meal received:', normalizedNew);
      setMeals((prev) => {
        if (prev.some(m => m._id === normalizedNew._id)) return prev;
        return [...prev, normalizedNew];
      });
    });

    socket.on('createSuccess', ({ itemId }) => {
      console.log('New meal created, auto-unlocking:', itemId);
      const socket = getSocket();
      // Auto-unlock the just-created row
      socket.emit('unlockRow', { itemId });
    });

    socket.on('error', (err) => {
      alert(err.message || 'Something went wrong');
    });

    return () => {
      socket.off('mealsData');
      socket.off('newMealCreated');
      socket.off('rowUpdate');
      socket.off('error');
    };
  }, []);

  const handleAddMeal = () => {
    setSelectedMeal(null);
    setShowForm(true);
  };

  // In handleEditMeal
  const handleEditMeal = (meal) => {
    const itemId = meal._id || meal.itemId;
    if (!itemId) {
      console.error('No valid ID found for meal:', meal);
      alert('Cannot edit: invalid row data');
      return;
    }

    console.log('Locking item:', itemId);

    const socket = getSocket();
    socket.emit('lockRow', { itemId });

    const onLockSuccess = () => {
      setSelectedMeal({ ...meal, _id: itemId });
      setShowForm(true);
      socket.off('lockSuccess', onLockSuccess);
    };

    const onError = (err) => {
      alert(err.message || 'Cannot edit right now');
      socket.off('error', onError);
    };

    socket.once('lockSuccess', onLockSuccess);
    socket.once('error', onError);
  };

  const handleSaveMeal = (formData) => {
    const socket = getSocket();

    if (selectedMeal) {
      // Update existing
      socket.emit('unlockRow', {
        itemId: selectedMeal._id,
        newData: formData,
      });
    } else {
      const socket = getSocket();
      socket.emit('createMeal', { data: formData });
      socket.on('mealsData', (data) => {
        console.log('Received meals Again:', data);
        setMeals(data);
      });
      // Optionally listen for 'createSuccess' if you want to do something after
    }

    setShowForm(false);
  };

  const handleCancel = () => {
    if (selectedMeal) {
      // Unlock without saving
      const socket = getSocket();
      socket.emit('unlockRow', { itemId: selectedMeal._id });
    }
    setShowForm(false);
  };

  return (
    <div className="dashboard-container">
      <h1>Friends Hub – Welcome, {user?.username || 'Guest'}!</h1>

      <section className="meals-section">
        <div className="section-header">
          <h2>Meals / Lunch Planner</h2>
          <button className="add-btn" onClick={handleAddMeal}>
            + Add New Meal
          </button>
        </div>

        <table className="meals-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Dish</th>
              <th>Assigned To</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {meals.length === 0 ? (
              <tr>
                <td colSpan="5" className="empty-message">
                  No meals yet. Add one!
                </td>
              </tr>
            ) : (
              meals.map((meal, index) => (
                <tr key={index}>
                  <td>{meal.data?.date || '-'}</td>
                  <td>{meal.data?.dish || '-'}</td>
                  <td>{meal.data?.assigned || '-'}</td>
                  <td className={`status-cell ${meal.status === 'Updating' ? 'status-updating' : 'status-updated'}`}>
                    {meal.status}
                    {meal.status === 'Updating' && meal.lockedByUsername && (
                      <span> by {meal.lockedByUsername}</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="edit-btn"
                      onClick={() => handleEditMeal(meal)}
                      disabled={meal.status === 'Updating'}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {showForm && (
          <div className="meal-form-modal">
            <div className="modal-content">
              <h3>{selectedMeal ? 'Edit Meal' : 'New Meal'}</h3>
              <MealForm
                initialData={selectedMeal?.data || {}}
                onSave={handleSaveMeal}
                onCancel={handleCancel}
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// Reusable Form Component
function MealForm({ initialData, onSave, onCancel }) {
  const [form, setForm] = useState({
    date: initialData.date || '',
    dish: initialData.dish || '',
    assigned: initialData.assigned || '',
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="meal-form">
      <div className="form-group">
        <label>Date</label>
        <input type="date" name="date" value={form.date} onChange={handleChange} required />
      </div>

      <div className="form-group">
        <label>Dish</label>
        <input type="text" name="dish" value={form.dish} onChange={handleChange} required />
      </div>

      <div className="form-group">
        <label>Assigned To</label>
        <input type="text" name="assigned" value={form.assigned} onChange={handleChange} />
      </div>

      <div className="form-actions">
        <button type="submit" className="save-btn">Save</button>
        <button type="button" className="cancel-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default Dashboard;